from setuptools import setup, find_packages

setup(
    name="agentid",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "httpx>=0.27.0",
        "cryptography>=42.0.0",
        "PyJWT>=2.8.0",
    ],
    python_requires=">=3.10",
    description="AgentID SDK — Identity & verification for AI agents",
    author="AgentID",
    url="https://getagentid.dev",
)
