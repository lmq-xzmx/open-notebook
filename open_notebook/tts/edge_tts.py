"""
Edge TTS 提供者

免费的微软 Azure 认知服务 TTS，支持 100+ 种语言，高质量 Neural Voices。
"""
import asyncio
import tempfile
from pathlib import Path
from typing import Optional, Tuple

from loguru import logger

# Edge TTS 可能不在依赖中，先尝试导入
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False
    logger.warning("edge-tts 未安装，请运行: uv pip install edge-tts")


async def generate_speech(
    text: str,
    voice: str = "zh-CN-XiaoxiaoNeural",
    output_path: Optional[str] | None = None,
    rate: str = "+0%",
    volume: str = "+0%",
    pitch: str = "+0Hz",
) -> Tuple[bytes, str]:
    """
    使用 Edge TTS 生成语音

    Args:
        text: 要转换的文本
        voice: 语音名称 (默认中文女声)
        output_path: 输出文件路径，如果为 None 则返回字节数据
        rate: 语速调整 (如 "+10%", "-20%")
        volume: 音量调整 (如 "+5%", "-10%")
        pitch: 音调调整 (如 "+5Hz", "-10Hz")

    Returns:
        Tuple[bytes, str]: (音频数据, session_id)
    """
    if not EDGE_TTS_AVAILABLE:
        raise ValueError("edge-tts 未安装，请运行: uv pip install edge-tts")

    session_id = f"edge-tts-{id(text)}"

    try:
        communicate = edge_tts.Communicate(
            text,
            voice,
            rate=rate,
            volume=volume,
            pitch=pitch,
        )

        if output_path:
            await communicate.save(output_path)
            with open(output_path, 'rb') as f:
                audio_data = f.read()
            logger.debug(f"Edge TTS 音频已保存到: {output_path}")
        else:
            # 保存到临时文件再读取
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
                tmp_path = tmp.name
            await communicate.save(tmp_path)
            with open(tmp_path, 'rb') as f:
                audio_data = f.read()
            Path(tmp_path).unlink(missing_ok=True)

        return audio_data, session_id

    except Exception as e:
        logger.error(f"Edge TTS 生成失败: {e}")
        raise


async def generate_speech_to_file(
    text: str,
    output_path: str,
    voice: str = "zh-CN-XiaoxiaoNeural",
    **kwargs
) -> str:
    """
    生成语音并保存到文件

    Args:
        text: 要转换的文本
        output_path: 输出文件路径
        voice: 语音名称
        **kwargs: 其他参数传递给 generate_speech

    Returns:
        str: 输出文件路径
    """
    audio_data, session_id = await generate_speech(text, voice, output_path, **kwargs)
    logger.info(f"Edge TTS 生成完成, SessionId: {session_id}")
    return output_path


def is_edge_tts_available() -> bool:
    """检查 Edge TTS 是否可用"""
    return EDGE_TTS_AVAILABLE


def get_edge_tts_voices() -> dict:
    """
    获取 Edge TTS 支持的语音列表（按语言分组）

    Returns:
        dict: 语言 -> 语音列表
    """
    if not EDGE_TTS_AVAILABLE:
        return {}

    # 常用语音
    return {
        "zh-CN": [
            "zh-CN-XiaoxiaoNeural",  # 中文女声
            "zh-CN-YunxiNeural",     # 中文男声
            "zh-CN-XiaoyiNeural",    # 中文女声
            "zh-CN-YunyangNeural",   # 中文男声 (新闻)
            "zh-CN-XiaochenNeural",  # 中文女声 (客服)
        ],
        "en-US": [
            "en-US-JennyNeural",     # 英文女声
            "en-US-GuyNeural",       # 英文男声
            "en-US-AriaNeural",      # 英文女声 (广泛)
            "en-US-DavisNeural",     # 英文男声
        ],
        "ja-JP": [
            "ja-JP-NanamiNeural",    # 日语女声
            "ja-JP-KeitaNeural",     # 日语男声
        ],
        "ko-KR": [
            "ko-KR-SunHiNeural",     # 韩语女声
            "ko-KR-InJoonNeural",    # 韩语男声
        ],
    }