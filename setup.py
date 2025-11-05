from setuptools import setup, find_packages

with open('README.md', 'r', encoding='utf-8') as f:
    long_description = f.read()

setup(
    name='vixynt',
    version='0.1.0',
    description='Diffusion fine-tuning experiments using npcpy.ft.diff',
    long_description=long_description,
    long_description_content_type='text/markdown',
    url='https://github.com/NPC-Worldwide/vixynt',
    packages=find_packages(),
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
    ],
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Intended Audience :: Science/Research',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
    ],
)
