from setuptools import setup, find_packages

setup(
    name="getagentid",
    version="0.5.0",
    packages=find_packages(),
    install_requires=["httpx>=0.27.0", "PyNaCl>=1.5.0"],
    python_requires=">=3.8",
    description="AgentID SDK — Identity & verification for AI agents",
    long_description="The Identity & Discovery Layer for AI Agents. Register, verify, and discover agents with cryptographic certificates.",
    author="AgentID",
    author_email="haroldmalikfrimpong@gmail.com",
    url="https://getagentid.dev",
    project_urls={
        "Documentation": "https://getagentid.dev/docs",
        "GitHub": "https://github.com/haroldmalikfrimpong-ops/getagentid",
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
    ],
)
