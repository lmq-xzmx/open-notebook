import os

# ROOT DATA FOLDER
DATA_FOLDER = "./data"

# LANGGRAPH CHECKPOINT FILE
sqlite_folder = f"{DATA_FOLDER}/sqlite-db"
os.makedirs(sqlite_folder, exist_ok=True)
LANGGRAPH_CHECKPOINT_FILE = f"{sqlite_folder}/checkpoints.sqlite"

# UPLOADS FOLDER
UPLOADS_FOLDER = f"{DATA_FOLDER}/uploads"
os.makedirs(UPLOADS_FOLDER, exist_ok=True)

# TIKTOKEN CACHE FOLDER
# Reads TIKTOKEN_CACHE_DIR from the environment so Docker can redirect the cache
# to a path outside /data/ (which is typically volume-mounted and would hide the
# pre-baked encoding baked into the image at build time).
TIKTOKEN_CACHE_DIR = os.environ.get("TIKTOKEN_CACHE_DIR", "").strip() or f"{DATA_FOLDER}/tiktoken-cache"
os.makedirs(TIKTOKEN_CACHE_DIR, exist_ok=True)

# ==================== 腾讯云 TTS 配置 ====================
TENCENT_CLOUD_TTS = {
    'secret_id': os.getenv('TENCENT_CLOUD_TTS_SECRET_ID', ''),
    'secret_key': os.getenv('TENCENT_CLOUD_TTS_SECRET_KEY', ''),
    'region': os.getenv('TENCENT_CLOUD_TTS_REGION', 'ap-guangzhou'),
    'voice': os.getenv('TENCENT_CLOUD_TTS_VOICE', 'zh-CN'),
}

# ==================== MiniMax TTS 配置 ====================
MINIMAX_API_KEY = os.getenv('MINIMAX_API_KEY', '')
