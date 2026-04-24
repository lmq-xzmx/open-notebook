"""
统一的 TTS 接口

提供统一的 TTS 生成接口，支持多种提供者:
- Edge TTS (微软, 免费, 高质量)
- 腾讯云 TTS (备选)
- Esperanto (通过 ModelManager 集成)

使用示例:
    from open_notebook.tts.unified import generate_speech

    # 使用 Edge TTS (默认)
    audio_data = await generate_speech("你好", provider="edge")

    # 使用腾讯云 TTS
    audio_data = await generate_speech("你好", provider="tencent")

    # 使用默认提供者 (edge)
    audio_data = await generate_speech("你好")
"""
from enum import Enum
from typing import Optional, Tuple

from loguru import logger

from open_notebook.tts.edge_tts import is_edge_tts_available as _edge_available
from open_notebook.tts.tencent_tts import is_tencent_tts_configured as _tencent_configured
from open_notebook.tts.minimax_tts import is_minimax_tts_configured as _minimax_configured


class TTSProvider(Enum):
    """TTS 提供者枚举"""
    EDGE = "edge"
    TENCENT = "tencent"
    MINIMAX = "minimax"
    ESPERANTO = "esperanto"


def get_available_providers() -> list[str]:
    """
    获取可用的 TTS 提供者列表

    Returns:
        list[str]: 可用的提供者名称列表
    """
    providers = []
    if _edge_available():
        providers.append("edge")
    if _tencent_configured():
        providers.append("tencent")
    if _minimax_configured():
        providers.append("minimax")
    # Esperanto 提供者始终可用（通过 ModelManager）
    providers.append("esperanto")
    return providers


def get_default_provider() -> str:
    """
    获取默认的 TTS 提供者

    优先级: Edge TTS > 腾讯云 TTS > Esperanto

    Returns:
        str: 默认提供者名称
    """
    if _edge_available():
        return "edge"
    if _tencent_configured():
        return "tencent"
    return "esperanto"


async def generate_speech(
    text: str,
    provider: Optional[str] = None,
    voice: str = "zh-CN-XiaoxiaoNeural",
    output_path: Optional[str] = None,
    **kwargs
) -> Tuple[bytes, str]:
    """
    统一的 TTS 生成接口

    Args:
        text: 要转换的文本
        provider: TTS 提供者 ("edge", "tencent", "esperanto")，如果为 None 则使用默认
        voice: 语音名称或类型
        output_path: 输出文件路径，如果为 None 则返回字节数据
        **kwargs: 其他参数（传递给具体提供者）

    Returns:
        Tuple[bytes, str]: (音频数据, session_id)

    Raises:
        ValueError: 当指定提供者不可用时
    """
    if provider is None:
        provider = get_default_provider()

    if provider == "edge":
        if not _edge_available():
            raise ValueError("Edge TTS 不可用，请安装 edge-tts 或使用其他提供者")
        from open_notebook.tts.edge_tts import generate_speech as edge_generate
        return await edge_generate(text, voice=voice, output_path=output_path, **kwargs)

    elif provider == "tencent":
        if not _tencent_configured():
            raise ValueError("腾讯云 TTS 未配置，请设置 TENCENT_CLOUD_TTS_SECRET_ID 和 TENCENT_CLOUD_TTS_SECRET_KEY")
        from open_notebook.tts.tencent_tts import generate_speech as tencent_generate
        # 腾讯云使用 voice_type 而不是 voice 名称
        voice_type = kwargs.pop("voice_type", 1)  # 默认中文
        return await tencent_generate(text, voice_type=voice_type, output_path=output_path, **kwargs)

    elif provider == "minimax":
        if not _minimax_configured():
            raise ValueError("MiniMax TTS 未配置，请设置 MINIMAX_API_KEY 环境变量")
        from open_notebook.tts.minimax_tts import generate_speech as minimax_generate
        model = kwargs.pop("model", "speech-02-hd")
        return await minimax_generate(text, model=model, voice_id=voice, output_path=output_path, **kwargs)

    elif provider == "esperanto":
        raise ValueError(
            "Esperanto TTS 需要通过 ModelManager 使用，"
            "请使用 open_notebook.ai.models.model_manager.get_text_to_speech()"
        )

    else:
        raise ValueError(f"未知的 TTS 提供者: {provider}, 可用: {get_available_providers()}")


async def generate_speech_to_file(
    text: str,
    output_path: str,
    provider: Optional[str] = None,
    voice: str = "zh-CN-XiaoxiaoNeural",
    **kwargs
) -> str:
    """
    生成语音并保存到文件

    Args:
        text: 要转换的文本
        output_path: 输出文件路径
        provider: TTS 提供者
        voice: 语音名称
        **kwargs: 其他参数

    Returns:
        str: 输出文件路径
    """
    audio_data, session_id = await generate_speech(
        text, provider=provider, voice=voice, output_path=output_path, **kwargs
    )
    return output_path


def is_provider_available(provider: str) -> bool:
    """
    检查指定提供者是否可用

    Args:
        provider: 提供者名称

    Returns:
        bool: 是否可用
    """
    if provider == "edge":
        return _edge_available()
    elif provider == "tencent":
        return _tencent_configured()
    elif provider == "minimax":
        return _minimax_configured()
    elif provider == "esperanto":
        return True  # Esperanto 始终可用
    return False


def get_provider_info(provider: str) -> dict:
    """
    获取提供者信息

    Args:
        provider: 提供者名称

    Returns:
        dict: 提供者信息
    """
    info = {
        "edge": {
            "name": "Edge TTS",
            "description": "微软 Azure 认知服务，免费高质量 TTS",
            "available": _edge_available(),
            "supports": ["mp3", "opus"],
            "voices": "100+ 种语言",
        },
        "tencent": {
            "name": "腾讯云 TTS",
            "description": "腾讯云语音合成服务，需要 API 密钥",
            "available": _tencent_configured(),
            "supports": ["wav", "mp3", "pcm"],
            "voices": "支持多种语言",
        },
        "minimax": {
            "name": "MiniMax TTS",
            "description": "MiniMax 语音合成，支持多种语言和音色",
            "available": _minimax_configured(),
            "supports": ["mp3"],
            "voices": "支持 40+ 种语言",
        },
        "esperanto": {
            "name": "Esperanto",
            "description": "通过 ModelManager 集成，支持 OpenAI、ElevenLabs 等",
            "available": True,
            "supports": ["provider-dependent"],
            "voices": "provider-dependent",
        },
    }
    return info.get(provider, {})