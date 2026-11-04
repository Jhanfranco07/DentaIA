"""Download immutable LFS object and verify before atomic installation."""
import sys
from pathlib import Path
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.model import EXPECTED_SIZE, verify_weights

COMMIT = "f02596a0227b9eaf767b955cd67196236111a3d5"
URL = f"https://media.githubusercontent.com/media/Eeman1113/dental_study/{COMMIT}/best.pt"


def main():
    target = Path(__file__).resolve().parents[1] / "models/best.pt"
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        verify_weights(target)
        print("Existing weights verified")
        return
    temporary = target.with_suffix(".download")
    try:
        with urlopen(URL, timeout=60) as response, temporary.open("wb") as output:
            size = 0
            while chunk := response.read(1024 * 1024):
                size += len(chunk)
                if size > EXPECTED_SIZE:
                    raise ValueError("Download exceeds expected size")
                output.write(chunk)
        verify_weights(temporary)
        temporary.replace(target)
        print("Real weights verified and installed")
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
