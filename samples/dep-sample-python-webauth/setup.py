from setuptools import find_packages, setup

setup(
    name='stratos_python_sample_webapp',
    version='1.0.0',
    packages=find_packages(),
    include_package_data=True,
    zip_safe=False,
    install_requires=[
        'flask',
        'PyJWT==2.4.0'
    ],
)
