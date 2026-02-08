"""Allow running vixynt as a module: python -m vixynt"""

import sys


USAGE = """\
vixynt - Vision model fine-tuning with npcpy

Available commands (run as modules):

  python -m vixynt.prepare_dataset  Prepare a dataset (discover, caption, augment)
  python -m vixynt.train            Train a vision model (diffusion or SFT)
  python -m vixynt.evaluate         Evaluate / generate samples / run inference
  python -m vixynt.generate         Generate images from trained or cloud models
  python -m vixynt.run_pipeline     Run the full prepare -> train -> evaluate pipeline

Each command supports --help for detailed usage.

Installed console scripts (after pip install):

  vixynt-prepare    vixynt-train    vixynt-eval
  vixynt-generate   vixynt-pipeline
"""


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help'):
        print(USAGE)
        return

    cmd = sys.argv[1]
    sys.argv = sys.argv[1:]  # shift so subcommand sees correct argv

    if cmd == 'prepare':
        from vixynt.prepare_dataset import main as run
    elif cmd == 'train':
        from vixynt.train import main as run
    elif cmd == 'evaluate':
        from vixynt.evaluate import main as run
    elif cmd == 'generate':
        from vixynt.generate import main as run
    elif cmd == 'pipeline':
        from vixynt.run_pipeline import main as run
    else:
        print(f"Unknown command: {cmd}")
        print(USAGE)
        return

    run()


if __name__ == '__main__':
    main()
