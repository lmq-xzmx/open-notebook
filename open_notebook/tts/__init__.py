"""
TTS 提供者模块

支持多种 TTS 服务:
- Edge TTS (微软, 免费)
- 腾讯云 TTS (备用)
- Esperanto (集成在 ModelManager 中)
- 统一接口 (自动选择可用提供者)
"""
from open_notebook.tts.edge_tts import (
    generate_speech as edge_generate_speech,
    generate_speech_to_file as edge_generate_speech_to_file,
    get_edge_tts_voices,
    is_edge_tts_available,
)
from open_notebook.tts.tencent_tts import (
    generate_speech as tencent_generate_speech,
    generate_speech_to_file as tencent_generate_speech_to_file,
    get_tencent_tts_voices,
    is_tencent_tts_configured,
)
from open_notebook.tts.minimax_tts import (
    generate_speech as minimax_generate_speech,
    generate_speech_to_file as minimax_generate_speech_to_file,
    get_minimax_tts_voices,
    is_minimax_tts_configured,
)
from open_notebook.tts.unified import (
    generate_speech,
    generate_speech_to_file,
    get_available_providers,
    get_default_provider,
    is_provider_available,
    get_provider_info,
    TTSProvider,
)

__all__ = [
    # Edge TTS
    "edge_generate_speech",
    "edge_generate_speech_to_file",
    "get_edge_tts_voices",
    "is_edge_tts_available",
    # 腾讯云 TTS
    "tencent_generate_speech",
    "tencent_generate_speech_to_file",
    "get_tencent_tts_voices",
    "is_tencent_tts_configured",
    # MiniMax TTS
    "minimax_generate_speech",
    "minimax_generate_speech_to_file",
    "get_minimax_tts_voices",
    "is_minimax_tts_configured",
    # 统一接口
    "generate_speech",
    "generate_speech_to_file",
    "get_available_providers",
    "get_default_provider",
    "is_provider_available",
    "get_provider_info",
    "TTSProvider",
]