"""
TTS Audio Generator - 替换 podcast-creator 的音频生成

支持 edge-tts、腾讯云 TTS 和 MiniMax TTS 作为音频生成的后端。
当 tts_provider 是 "edge"、"tencent" 或 "minimax" 时，使用对应的 TTS 模块生成音频。
"""
from pathlib import Path
from typing import Dict

from loguru import logger

from open_notebook.tts.edge_tts import generate_speech as edge_generate_speech
from open_notebook.tts.tencent_tts import generate_speech as tencent_generate_speech
from open_notebook.tts.minimax_tts import generate_speech as minimax_generate_speech


async def generate_audio_with_tts_provider(
    dialogue_text: str,
    speaker_name: str,
    output_path: Path,
    tts_provider: str,
    tts_model: str,
    voices: Dict[str, str],
    tts_config: Dict,
) -> Path:
    """
    根据 tts_provider 生成音频

    Args:
        dialogue_text: 要转换的对话文本
        speaker_name: 说话者名称
        output_path: 输出文件路径
        tts_provider: TTS 提供者 ("edge", "tencent", 或其他 Esperanto provider)
        tts_model: TTS 模型/声音
        voices: 说话者到声音的映射
        tts_config: TTS 配置

    Returns:
        Path: 生成的音频文件路径
    """
    voice_id = voices.get(speaker_name, voices.get(list(voices.keys())[0], "zh-CN-XiaoxiaoNeural"))

    logger.info(f"Generating audio for '{speaker_name}' using {tts_provider}: {tts_model} with voice {voice_id}")

    if tts_provider == "edge":
        # Edge TTS
        await edge_generate_speech(
            text=dialogue_text,
            voice=voice_id,
            output_path=str(output_path),
        )
        logger.info(f"Edge TTS audio saved: {output_path}")

    elif tts_provider == "tencent":
        # 腾讯云 TTS
        voice_type = int(tts_model) if tts_model.isdigit() else 1  # 默认中文
        await tencent_generate_speech(
            text=dialogue_text,
            voice_type=voice_type,
            output_path=str(output_path),
        )
        logger.info(f"Tencent TTS audio saved: {output_path}")

    elif tts_provider == "minimax":
        # MiniMax TTS
        await minimax_generate_speech(
            text=dialogue_text,
            model=tts_model or "speech-02-hd",
            voice_id=voice_id,
            output_path=str(output_path),
        )
        logger.info(f"MiniMax TTS audio saved: {output_path}")

    else:
        # 使用 Esperanto (原始逻辑)
        from esperanto import AIFactory

        # Extract named params from tts_config, pass rest as kwargs
        api_key = tts_config.pop("api_key", None)
        base_url = tts_config.pop("base_url", None)

        tts_model_obj = AIFactory.create_text_to_speech(
            tts_provider, tts_model, api_key=api_key, base_url=base_url, **tts_config
        )
        await tts_model_obj.agenerate_speech(
            text=dialogue_text, voice=voice_id, output_file=output_path
        )
        logger.info(f"Esperanto TTS audio saved: {output_path}")

    return output_path


def patch_podcast_creator_audio_generation():
    """
    Monkey-patch podcast-creator 的音频生成函数

    将 AIFactory.create_text_to_speech 替换为支持 edge/tencent 的版本
    """
    try:
        from podcast_creator.nodes import generate_single_audio_clip
        import podcast_creator.nodes as nodes_module
    except ImportError:
        logger.warning("Could not import podcast_creator.nodes, skipping patch")
        return

    # 原始函数
    original_generate = generate_single_audio_clip

    async def patched_generate_single_audio_clip(dialogue_info: Dict) -> Path:
        """替换的音频生成函数，支持 edge、tencent 和 minimax TTS"""
        tts_provider = dialogue_info.get("tts_provider")
        tts_provider_type = dialogue_info.get("tts_provider_type", "model")

        # 如果是 edge、tencent、minimax 或 minimax provider，使用我们的 TTS 模块
        if tts_provider_type in ("edge", "tencent", "minimax") or tts_provider == "minimax":
            from pathlib import Path

            dialogue = dialogue_info["dialogue"]
            index = dialogue_info["index"]
            output_dir = dialogue_info["output_dir"]
            tts_model = dialogue_info["tts_model"]
            voices = dialogue_info["voices"]
            tts_config = dict(dialogue_info.get("tts_config") or {})

            clips_dir = output_dir / "clips"
            clips_dir.mkdir(exist_ok=True, parents=True)

            filename = f"{index:04d}.mp3"
            clip_path = clips_dir / filename

            return await generate_audio_with_tts_provider(
                dialogue_text=dialogue.dialogue,
                speaker_name=dialogue.speaker,
                output_path=clip_path,
                tts_provider=tts_provider,
                tts_model=tts_model,
                voices=voices,
                tts_config=tts_config,
            )

        # 否则使用原始的 Esperanto TTS
        return await original_generate(dialogue_info)

    # 应用 patch
    nodes_module.generate_single_audio_clip = patched_generate_single_audio_clip
    logger.info("Patched podcast-creator audio generation to support edge/tencent TTS")