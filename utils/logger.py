import logging

logging.basicConfig(
    filename="cravehub.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger("CraveHub")
