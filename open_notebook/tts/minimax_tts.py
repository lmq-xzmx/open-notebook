"""
MiniMax TTS 提供者

支持 MiniMax 语音合成 API，包括异步工作流。
"""
import asyncio
import io
import tarfile
import uuid
from typing import Optional, Tuple

import httpx
from loguru import logger

# MiniMax API 端点
MINIMAX_API_BASE = "https://api.minimaxi.com"

# 默认模型（speech-2.8-hd 是当前可用的模型）
DEFAULT_MODEL = "speech-2.8-hd"


def is_minimax_tts_configured() -> bool:
    """检查 MiniMax TTS 是否已配置（环境变量方式，检查 MINIMAX_API_KEY）"""
    import os
    return bool(os.environ.get('MINIMAX_API_KEY', ''))


async def generate_speech(
    text: str,
    model: str = DEFAULT_MODEL,
    voice_id: str = "male-qn-qingse",
    output_path: Optional[str] = None,
    speed: float = 1.0,
    vol: float = 10,
    pitch: float = 1.0,
    timeout: int = 60,
    api_key: Optional[str] = None,
) -> Tuple[bytes, str]:
    """
    使用 MiniMax TTS 生成语音（异步工作流）

    Args:
        text: 要转换的文本
        model: MiniMax TTS 模型 (speech-2.8-hd 等)
        voice_id: 语音 ID
        output_path: 输出文件路径，如果为 None 则返回字节数据
        speed: 语速 (0.5-2.0)
        vol: 音量 (0-10)
        pitch: 音调 (0.5-2.0)
        timeout: 超时时间（秒）
        api_key: MiniMax API Key，如果为 None 则从环境变量 MINIMAX_API_KEY 获取

    Returns:
        Tuple[bytes, str]: (音频数据, session_id)
    """
    import os
    if api_key is None:
        api_key = os.environ.get('MINIMAX_API_KEY', '')
    if not api_key:
        raise ValueError(
            "MiniMax TTS 未配置，请设置 MINIMAX_API_KEY 环境变量"
        )
    session_id = f"minimax-tts-{uuid.uuid4().hex[:8]}"

    logger.info(f"MiniMax TTS: model={model}, voice_id={voice_id}")

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            # Step 1: 创建语音合成任务
            create_url = f"{MINIMAX_API_BASE}/v1/t2a_async_v2"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model,
                "text": text,
                "voice_setting": {
                    "voice_id": voice_id,
                },
            }

            create_response = await client.post(
                create_url, headers=headers, json=payload
            )
            create_data = create_response.json()

            # 检查错误
            base_resp = create_data.get("base_resp", {})
            status_code = base_resp.get("status_code")
            if status_code and status_code != 0:
                status_msg = base_resp.get("status_msg", "")
                if status_code == 2061:
                    raise ValueError(f"您的账户不支持该模型 {model}，请升级您的 MiniMax 套餐: {status_msg}")
                elif status_code == 2013:
                    raise ValueError(f"参数错误: {status_msg}")
                else:
                    raise ValueError(f"MiniMax API 错误 {status_code}: {status_msg}")

            task_id = create_data.get("task_id")
            if not task_id:
                raise ValueError(f"创建 MiniMax TTS 任务失败: {create_data}")

            logger.debug(f"MiniMax TTS 任务已创建: task_id={task_id}")

            # Step 2: 轮询任务状态
            query_url = f"{MINIMAX_API_BASE}/v1/query/t2a_async_query_v2?task_id={task_id}"

            for attempt in range(timeout // 2):
                await asyncio.sleep(2)

                query_response = await client.get(query_url, headers=headers)
                query_data = query_response.json()

                status = query_data.get("status", "").lower()
                logger.debug(f"MiniMax TTS 任务状态: {status} (attempt {attempt + 1})")

                if status == "success":
                    file_id = query_data.get("file_id")
                    break
                elif status in ("processing", "pending"):
                    continue
                elif status == "failed":
                    err_msg = query_data.get("desc", "Unknown error")
                    raise ValueError(f"MiniMax TTS 任务失败: {err_msg}")
                else:
                    raise ValueError(f"未知任务状态: {status}")
            else:
                raise ValueError("MiniMax TTS 任务超时")

            if not file_id:
                raise ValueError("MiniMax TTS 任务超时或未返回 file_id")

            # Step 3: 下载音频文件
            download_url = f"{MINIMAX_API_BASE}/v1/files/retrieve_content?file_id={file_id}"
            download_response = await client.get(download_url, headers=headers)
            download_response.raise_for_status()

            audio_data = _extract_audio_from_tar(download_response.content)

            # 如果提供了输出路径，保存文件
            if output_path:
                with open(output_path, "wb") as f:
                    f.write(audio_data)
                logger.debug(f"MiniMax TTS 音频已保存到: {output_path}")

            logger.info(f"MiniMax TTS 生成完成, SessionId: {session_id}, 大小: {len(audio_data)} bytes")
            return audio_data, session_id

    except httpx.HTTPStatusError as e:
        logger.error(f"MiniMax TTS HTTP 错误: {e.response.status_code} - {e.response.text[:200]}")
        raise
    except Exception as e:
        logger.error(f"MiniMax TTS 生成失败: {e}")
        raise


def _extract_audio_from_tar(content: bytes) -> bytes:
    """从 tar 归档中提取 MP3 音频文件"""
    try:
        with tarfile.open(fileobj=io.BytesIO(content)) as tar:
            for member in tar.getmembers():
                if member.name.endswith('.mp3'):
                    f = tar.extractfile(member)
                    if f:
                        return f.read()
        # 如果不是 tar 或没找到 MP3，返回原始内容
        logger.warning("MiniMax TTS: 响应不是 tar 归档或未找到 MP3 文件")
        return content
    except Exception as e:
        logger.warning(f"MiniMax TTS: 解压 tar 失败: {e}")
        return content


async def generate_speech_to_file(
    text: str,
    output_path: str,
    model: str = DEFAULT_MODEL,
    voice_id: str = "male-qn-qingse",
    **kwargs
) -> str:
    """
    生成语音并保存到文件

    Args:
        text: 要转换的文本
        output_path: 输出文件路径
        model: MiniMax TTS 模型
        voice_id: 语音 ID
        **kwargs: 其他参数传递给 generate_speech

    Returns:
        str: 输出文件路径
    """
    audio_data, session_id = await generate_speech(
        text, model=model, voice_id=voice_id, output_path=output_path, **kwargs
    )
    logger.info(f"MiniMax TTS 生成完成, SessionId: {session_id}")
    return output_path


def get_minimax_tts_voices() -> dict:
    """
    获取 MiniMax TTS 支持的语音列表（实际 API voice_id）

    Returns:
        dict: 按语言分组的语音列表
    """
    return {
        "中文-青年": [
            "male-qn-qingse",    # 青涩青年音色
            "male-qn-jingying",  # 精英青年音色
            "male-qn-badao",      # 霸道青年音色
            "male-qn-daxuesheng", # 青年大学生音色
            "female-shaonv",      # 少女音色
        ],
        "中文-通用": [
            "male-qn-666",        # 男声测试
            "female-tianmei",    # 甜美女声
        ],
    }


async def get_available_voices(api_key: str) -> dict:
    """
    从 MiniMax API 获取可用的音色列表

    Args:
        api_key: MiniMax API key

    Returns:
        dict: 包含 system_voice, voice_cloning, voice_generation 的字典
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{MINIMAX_API_BASE}/v1/get_voice",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={"voice_type": "all"},
            )
            response.raise_for_status()
            data = response.json()
            return {
                "system_voice": data.get("system_voice", []),
                "voice_cloning": data.get("voice_cloning", []),
                "voice_generation": data.get("voice_generation", []),
            }
    except Exception as e:
        logger.error(f"获取 MiniMax 音色列表失败: {e}")
        return {"system_voice": [], "voice_cloning": [], "voice_generation": []}
