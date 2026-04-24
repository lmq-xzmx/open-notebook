"""
腾讯云 TTS 提供者

作为 esperanto TTS 的备选方案，支持腾讯云语音合成服务。
"""
import base64
import uuid
from typing import Optional, Tuple

import httpx
from loguru import logger

from open_notebook.config import TENCENT_CLOUD_TTS

# 腾讯云 TTS 配置
TENCENT_TTS_CONFIG = TENCENT_CLOUD_TTS


def is_tencent_tts_configured() -> bool:
    """检查腾讯云 TTS 是否已配置"""
    return bool(TENCENT_TTS_CONFIG.get('secret_id') and TENCENT_TTS_CONFIG.get('secret_key'))


async def generate_speech(
    text: str,
    voice_type: int = 1,
    model_type: int = 1,
    output_path: Optional[str] = None,
    speed: float = 1.0,
    volume: float = 1.0,
) -> Tuple[bytes, str]:
    """
    使用腾讯云 TTS 生成语音

    Args:
        text: 要转换的文本
        voice_type: 语音类型 (1=中文, 0=英文)
        model_type: 模型类型 (1=实时语音合成)
        output_path: 输出文件路径，如果为 None 则返回字节数据
        speed: 语速 (0.5-2.0)
        volume: 音量 (0.5-2.0)

    Returns:
        Tuple[bytes, str]: (音频数据, session_id)
    """
    if not is_tencent_tts_configured():
        raise ValueError("腾讯云 TTS 未配置，请设置 TENCENT_CLOUD_TTS_SECRET_ID 和 TENCENT_CLOUD_TTS_SECRET_KEY")

    secret_id = TENCENT_TTS_CONFIG['secret_id']
    secret_key = TENCENT_TTS_CONFIG['secret_key']
    region = TENCENT_TTS_CONFIG.get('region', 'ap-guangzhou')

    # 使用腾讯云 SDK
    from tencentcloud.common import credential
    from tencentcloud.tts.v20190823.tts_client_async import TtsClient
    from tencentcloud.tts.v20190823 import models

    try:
        cred = credential.Credential(secret_id, secret_key)
        client = TtsClient(cred, region)

        req = models.TextToVoiceRequest()
        req.Text = text
        req.VoiceType = voice_type
        req.SessionId = str(uuid.uuid4())
        req.ModelType = model_type
        req.Speed = speed
        req.Volume = volume

        resp = await client.TextToVoice(req)

        if not resp.Audio:
            raise ValueError("腾讯云 TTS 返回空音频数据")

        audio_data = base64.b64decode(resp.Audio)

        # 如果提供了输出路径，保存文件
        if output_path:
            with open(output_path, 'wb') as f:
                f.write(audio_data)
            logger.debug(f"腾讯云 TTS 音频已保存到: {output_path}")

        return audio_data, resp.SessionId

    except Exception as e:
        logger.error(f"腾讯云 TTS 生成失败: {e}")
        raise


async def generate_speech_to_file(
    text: str,
    output_path: str,
    voice_type: int = 1,
    **kwargs
) -> str:
    """
    生成语音并保存到文件

    Args:
        text: 要转换的文本
        output_path: 输出文件路径
        voice_type: 语音类型 (1=中文, 0=英文)
        **kwargs: 其他参数传递给 generate_speech

    Returns:
        str: 输出文件路径
    """
    audio_data, session_id = await generate_speech(text, voice_type, output_path=output_path, **kwargs)
    logger.info(f"腾讯云 TTS 生成完成, SessionId: {session_id}")
    return output_path


def get_tencent_tts_voices() -> dict:
    """
    获取腾讯云 TTS 支持的语音列表

    Returns:
        dict: 语音类型映射
    """
    return {
        0: "英文发音",
        1: "中文发音",
        2: "中文英文混合发音",
        5: "韩文发音",
        6: "日文发音",
        7: "西班牙文发音",
        8: "法文发音",
        9: "德文发音",
        10: "俄文发音",
        11: "葡萄牙文发音",
        12: "意大利文发音",
        13: "印尼文发音",
        14: "荷兰文发音",
        15: "菲律宾文发音",
        16: "印度文发音",
    }