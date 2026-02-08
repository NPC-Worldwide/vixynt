from setuptools import setup, find_packages

with open('README.md', 'r', encoding='utf-8') as f:
    long_description = f.read()

setup(
    name='vixynt',
    version='0.2.0',
    description='Vision model fine-tuning with npcpy and intelligent data augmentation',
    long_description=long_description,
    long_description_content_type='text/markdown',
    url='https://github.com/NPC-Worldwide/vixynt',
    package_dir={'': 'src'},
    packages=find_packages(where='src'),
    python_requires='>=3.8',
    install_requires=[
        'torch>=1.9.0',
        'torchvision>=0.10.0',
        'numpy>=1.21.0',
        'pandas>=1.3.0',
        'scipy>=1.7.0',
        'matplotlib>=3.4.0',
        'Pillow>=8.3.0',
        'tqdm>=4.62.0',
        'pyyaml>=5.4.0',
        'scikit-learn>=1.0.0',
        'npcpy>=0.3.0',
    ],
    entry_points={
        'console_scripts': [
            'vixynt-prepare=vixynt.prepare_dataset:main',
            'vixynt-train=vixynt.train:main',
            'vixynt-eval=vixynt.evaluate:main',
            'vixynt-generate=vixynt.generate:main',
            'vixynt-pipeline=vixynt.run_pipeline:main',
        ],
    },
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Science/Research',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
    ],
)
