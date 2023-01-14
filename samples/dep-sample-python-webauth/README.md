# Authentication for Web Application in Python

## Overview

This example shows how you can use Stratos Authentication with Python application along with custom domain name in `https://*.stratos.shell` format

The app has a three different endpoints:

- `/healthcheck` - Available without token. Return ok.
- `/` - displays the token in HTTP headers from request. Used to verify that `X-Vouch-IdP-Accesstoken` is present.
- `/protectedresource` - return a string displays. Requires the user to be logged on
  
## What you will learn?

- structure of the Stratos Deployment Engine manifest
- manifest declaration for deployment of web application written in Python into Azure App Service
- multi-stage CI/CD definition using Azure Dev Ops pipelines, including

  - building project
  - publishing zipfile as artifact used by deployment stages
  - invoking Stratos Deployment Engine
  - deploying the zipfile artifact to Function App provisioned by Stratos Deployment Engine
  - creating ingress rules
  - using tokens

## Repository

You can find the full source code for this sample in [stratos-python-sample-webapp repository](https://sede-ds-adp.visualstudio.com/Platform%20-%20General/_git/stratos-python-sample-webauth)

## Prerequisites

To deploy the sample in your subscription, you will need to:

- Be on-boarded to the Deployment Engine Platform. 

- Create Azure Dev Ops service connection to Azure Resource Manager in each of your environments you intend to deploy to.

    It is used to connect to your Azure subscription. The sample uses convention based name: `projectStream-workStream-pub-environment`. E.g. `slmt-4d-pub-sbx`, `powr-imb-dev`.

    See [how to create service connection with certificate based SPN](https://portproxy.azurewebsites.net/Getting-started-with-Shell-Energy-Data-Platform/Other-platform-tutorials-_logging_-metrics_-etc._/Creating-Service-connection-with-Certificate-based-SPN-_Service-Principal_-in-Azure-Devops/). Your `Service Principal ID` is in your key-vault under `clientId` name. Your SPN certificate is also in your key-vault, in the `Certificates` tab.

- Create environments in your Azure Dev Ops under Environments. The sample uses `sbx`, `dev` and `prd` names. See [How to create an environment in Azure Dev Ops Library](https://docs.microsoft.com/en-us/azure/devops/pipelines/process/environments?view=azure-devops#create-an-environment)

- Create variable groups in Azure Dev Ops containing Stratos Deployment Token for each of the environments you intend to deploy to.

    The sample uses convention based name for this group: `PROJECTSTREAM_WORKSTREAM_ENVIRONMENT`. E.g. `SLMT_4D_SBX`, `POWR_IMB_DEV`.

    This variable group should contain `STRATOS_DEPLOYMENT_TOKEN` variable. The value to be used you can find in the key-vault given to you as part of on-boarding, under `f4dptoken` name.

    Refer to instructions in Microsoft Docs on [how to create a variable group](https://docs.microsoft.com/en-us/azure/devops/pipelines/library/variable-groups?view=azure-devops&tabs=classic#create-a-variable-group)

## Explanation

### stratos-deploy.yml

App Service is declared by the code section below,

``` yaml
  appservice:
    - nameSuffix: stratos-python-sample-websso
      osType: linux
      siteConfigRequired: true
      linuxFxVersion: PYTHON|3.8
      ingressHostName: #{IngressHostName}#
```

When you use `ingressHostName`, Stratos will:

- set firewall rules on your App Service to only allow traffic from Stratos nginx instance
- create appropriate DNS entries for specified ingress host name
- confgiure Stratos nginx instance to route traffix to your app service
- issue a SSL certificate
- configure nginx to require authentication when accessing your host name

> WARNING: at the moment of writing configuration of authentication in nginx is not yet automated. Please contact Stratos team to configure it manually for you until the automation work is completed.

`#{IngressHostName}#` will be replaced with value appropriate for specific environment by a task in `azure-pipelines.yml`. It must be in format `*.stratos.shell (production environments)` or `*.dev.stratos.shell` (all other environments), with optional .com suffix.
For a full list of accepted parameters please refer to [Stratos App Service deployment manifest documentation PLACEHOLDER](/Stratos-Wiki/Link/To/AppService/Doc)

## azure-pipelines.yml

### Variables

At top of the file, there's a list of variables,

``` yaml
variables:
  ProjectStream: exam
  WorkStream: app
  Placement: pub
  AppNameSuffix: stratos-python-sample-websso

  ArtifactsDirectory: $(Pipeline.Workspace)
  ArtifactStagingDirectory: $(ArtifactsDirectory)/dist
  ArtifactSourceStagingDirectory: $(ArtifactsDirectory)/sdist
  DeployManifestName: stratos-deploy.yml
  IsMasterBranch: $[eq(variables['Build.SourceBranch'], 'refs/heads/main')]

```

- `ProjectStream`: project stream as given during on-boarding process.
- `WorkStream`: work stream as given during on-boarding process.
- `Placement`: whether your subscription is public or private. 
- `AppNameSuffix`: Used to construct full Azure resource name. This matches `nameSuffix` in the `stratos-deploy.yml` file.

- `ArtifactDirectory`: path to stage the artifact content to for upload and download, i.e. zipfile and Stratos deployment manifest
- `IsMasterBranch`: used to decide whether the code should be deployed to `dev` and `prd` environment. Branches other than `main` will only be deployed to `sbx` environment.

### Stages

The pipeline consists of 4 stages: `Build`, `DeploySandbox`, `DeployDevelopment`, `DeployProduction`. They ran one after another and they require previous stage to be completed successfully. `DeployDevelopment` and `DeployProduction` run only when `main` branch triggers the build.

#### Build stage

Build stage is responsible for building the Python project, packaging it in a zip file and publishing the zip file along with stratos-deploy.yml as a pipeline artifact that is used by later stages.

> IMPORTANT NOTE: The virtual environment must be named `antenv`. Otherwise, the web application will not find the Python libraries.

```yaml
- stage: Build
  jobs:
  - job: Build
    pool:
      vmImage: 'ubuntu-latest'
    strategy:
      matrix:
        Python38:
          python.version: '3.8'
    steps:
    - task: UsePythonVersion@0
      inputs:
        versionSpec: '$(python.version)'
        displayName: 'Use Python $(python.version)'

    - task: PipAuthenticate@1
      displayName: 'Authenticate pip'
      inputs:
        artifactFeeds: 4b55d100-8e50-46cc-ab7b-ac35eaf91bfe/SEDP-Python
        onlyAddExtraIndex: true

    - script: |
        python -m venv antenv
        source antenv/bin/activate
        python -m pip install --upgrade pip keyring artifacts-keyring
        pip install -r requirements.txt
      displayName: 'Install dependencies'

    - script: |
        source antenv/bin/activate
        pip install pytest pytest-azurepipelines
        pip install -e .
        pytest
      displayName: 'Run tests'

    - task: CopyFiles@2
      displayName: "Copy app files"
      inputs:
        Contents: |
          **/*
          !.git/**/*
          !.pytest_cache/**/*
          !__pycache__/**/*
          !**/.pytest_cache/**/*
          !**/__pycache__/**/*
          !setup.py
        targetFolder: $(ArtifactSourceStagingDirectory)

    - task: ArchiveFiles@2
      displayName: "Archive files"
      inputs:
        rootFolderOrFile: "$(ArtifactSourceStagingDirectory)"
        includeRootFolder: false
        archiveFile: "$(ArtifactStagingDirectory)/app.zip"

    - task: CopyFiles@2
      displayName: "Copy manifests"
      inputs:
        Contents: |
          stratos*.yml
        targetFolder: $(ArtifactStagingDirectory)

    - publish: $(ArtifactStagingDirectory)
      artifact: dist
```

#### Deployment stages

The deployment stages consist of two steps: provisioning resource using stratos-deploy.yml and deploying zipfile to newly created web app.

`Region` variable is based on 'region' value in `stratos-deploy.yml`. For `europe` it should be `euw` (Europe West) for non-production environments and `eun` (Europe North) for production environments.

> `IngressHostName` variable will be used to replace `#{IngressHostName}#` placeholder in `stratos-deploy.yml`

``` yaml
- stage: DeploySandbox
  condition: "succeeded('Build')"
  pool:
    vmImage: 'ubuntu-latest'
  variables:
  - group: EXAM_APP_SBX
  - name: Region
    value: euw
  - name: IngressHostName
    value: python-sample-webauthsso-sbx.dev.stratos.shell
  jobs:
  - deployment: Sandbox
    environment: sbx
    strategy:
      runOnce:
        deploy:
          steps:
          - task: qetza.replacetokens.replacetokens-task.replacetokens@3
            inputs:
              targetFiles: '$(ArtifactStagingDirectory)/$(DeployManifestName)'
              actionOnMissing: 'fail'
              verbosity: 'detailed'

          - task: sedp-deploy-dev@0
            displayName: Provision infrastructure
            inputs:
              manifestpath: '$(ArtifactStagingDirectory)/$(DeployManifestName)'
              environment: $(Environment.Name)
              token: $(STRATOS_DEPLOYMENT_TOKEN)

          - task: AzureWebApp@1
            displayName: Deploy app
            inputs:
              azureSubscription: EXAM-APP-PUB-SBX
              appType: 'webAppLinux'
              appName: "$(ProjectStream)-$(WorkStream)-$(Placement)-$(Environment.Name)-$(Region)-100-appw-$(AppNameSuffix)"
              package: '$(ArtifactStagingDirectory)/**/*.zip'
              deploymentMethod: zipDeploy
              startupCommand: "gunicorn --bind=0.0.0.0 --timeout 600 --chdir webapp app:app"
```

## Code

The code has been generated by Stratos Python cookiecutter.

### Setup

Clone the repository and setup Python virtual environment,

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Test

```sh
pytest
```

### Try it out

Deployed in Stratos Platform's subscription.

- Print my token endoint: [https://python-sample-webauthsso-sbx.dev.stratos.shell/](https://python-sample-webauthsso-sbx.dev.stratos.shell/)
- Protected resource: [https://python-sample-webauthsso-sbx.dev.stratos.shell/protectedresource](https://python-sample-webauthsso-sbx.dev.stratos.shell/protectedresource)
- Healthcheck: [https://python-sample-webauthsso-sbx.dev.stratos.shell/healthcheck](https://python-sample-webauthsso-sbx.dev.stratos.shell/healthcheck)

### Clean up resources

The provisioned resources need to be cleaned up manually in Azure Portal. Filter resources by owner `Stratos` to find all the related resources created by this sample.

### See also

- [Stratos Deployment Engine manifest file documentation PLACEHOLDER](/Stratos-Wiki/Link/To/Manifest/Documentation)
- [App Service Stratos resource documentation PLACEHOLDER](/Stratos-Wiki/Link/To/AppService/Doc)
- [Azure Pipelines schema documentation](https://docs.microsoft.com/en-us/azure/devops/pipelines/yaml-schema?view=azure-devops&tabs=schema%2Cparameter-schema)
- [Stratos Deployment Task documentation PLACEHOLDER](/Stratos-Wiki/Link/To/SEDP-Deploy)
- [Azure App Service documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Startos Python SDK PLACEHOLDER](/Stratos-Wiki/Link/To/Python-SDK-Reference)
