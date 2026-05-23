# Deployment Setup

This folder contains deployment guidance for connecting the `rewaq` project to Vercel and GitHub.

## Existing GitHub Action

The repository already contains a deployment workflow in `.github/workflows/ci.yml` that:
- installs dependencies
- runs `npm run lint`
- runs `npm run build`
- deploys to Vercel when the `main` branch is updated

## Required GitHub Secrets

To enable automatic Vercel deployment from GitHub Actions, add these secrets in the repository settings:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## How to get the values

1. Sign in to Vercel: https://vercel.com/
2. Create or connect your GitHub repository to Vercel.
3. Generate a token from Vercel Settings -> Tokens.
4. Find `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` in your Vercel project settings.
5. Add the values in GitHub under `Settings -> Secrets and variables -> Actions`.

## Notes

- The current workflow only deploys from the `main` branch.
- If the deployment step is not running, ensure the secrets exist and the branch is `main`.
- If Vercel setup fails at "1 of 2" during import, confirm that the GitHub repo access permissions are correct and the repo belongs to the connected GitHub account.
