# Release Process

This document describes the automated release process for kb2midi using GitHub Actions.

## Release Types

### Beta Releases (Automatic)

**Trigger**: Automatically triggered on every push to `main` branch

**Version Format**: `vX.Y.Z-beta.N` (e.g., `v2.1.0-beta.1`, `v2.1.0-beta.2`)

**Process**:
1. Merge changes to `main` branch
2. GitHub Actions automatically:
   - Determines next beta version number
   - Creates a GitHub pre-release with the beta tag
   - Builds installers for all platforms:
     - macOS Universal (Intel + Apple Silicon)
     - macOS ARM64 (Apple Silicon)
     - macOS x64 (Intel)
     - Windows x64 (NSIS installer)
     - Linux x64 (AppImage)
   - Uploads all artifacts to the GitHub release

**Artifact Retention**: 30 days

**Use Case**: Testing new features, continuous deployment, early feedback

### Stable Releases (Manual)

**Trigger**: Manually triggered via GitHub Actions UI

**Version Format**: `vX.Y.Z` (e.g., `v2.1.0`)

**Process**:
1. Go to GitHub Actions → "Stable Release" workflow
2. Click "Run workflow"
3. Choose version bump type:
   - `patch` - Bug fixes (2.1.0 → 2.1.1)
   - `minor` - New features (2.1.0 → 2.2.0)
   - `major` - Breaking changes (2.1.0 → 3.0.0)
   - Or specify exact version (e.g., `2.5.0`)
4. Optionally add custom release notes
5. Click "Run workflow"

The workflow will:
- Bump version in `package.json`
- Commit and push version bump to `main`
- Create a git tag
- Generate changelog from commits
- Create a GitHub release
- Build and upload installers for all platforms

**Artifact Retention**: 90 days

**Use Case**: Production releases, stable versions for end users

## Workflow Files

### `.github/workflows/release-beta.yml`
- Triggered on: Push to `main`
- Creates: Pre-release with beta version
- Platforms: macOS (3 variants), Windows, Linux

### `.github/workflows/release-stable.yml`
- Triggered on: Manual workflow dispatch
- Creates: Stable release with semantic version
- Platforms: macOS (3 variants), Windows, Linux
- Auto-bumps version and creates git tag

## Platform-Specific Build Details

### macOS Builds
- **Universal**: Runs on both Intel and Apple Silicon natively
- **ARM64**: Optimized for Apple Silicon (M1/M2/M3)
- **x64**: Optimized for Intel Macs
- **Format**: DMG disk image
- **Runner**: `macos-latest`

### Windows Builds
- **Architecture**: x64
- **Format**: NSIS installer (.exe)
- **Runner**: `windows-latest`

### Linux Builds
- **Architecture**: x64
- **Format**: AppImage (portable, runs on most distros)
- **Runner**: `ubuntu-latest`

## How to Trigger a Stable Release

### Via GitHub Web UI:
1. Navigate to: `https://github.com/yourusername/kb2midi/actions`
2. Click on "Stable Release" in the left sidebar
3. Click "Run workflow" button (top right)
4. Fill in the form:
   - **version**: Choose `patch`, `minor`, `major`, or specify exact version
   - **release_notes**: (Optional) Custom release notes
5. Click green "Run workflow" button

### Via GitHub CLI:
```bash
# Patch release (2.1.0 → 2.1.1)
gh workflow run release-stable.yml -f version=patch

# Minor release (2.1.0 → 2.2.0)
gh workflow run release-stable.yml -f version=minor

# Major release (2.1.0 → 3.0.0)
gh workflow run release-stable.yml -f version=major

# Specific version
gh workflow run release-stable.yml -f version=2.5.0

# With custom release notes
gh workflow run release-stable.yml -f version=patch -f release_notes="Bug fixes and improvements"
```

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes, incompatible API changes
- **MINOR** (0.X.0): New features, backwards-compatible
- **PATCH** (0.0.X): Bug fixes, backwards-compatible

### Beta Versions
- Format: `X.Y.Z-beta.N`
- Beta number increments automatically based on existing beta tags
- Example: If `v2.1.0-beta.1` exists, next merge creates `v2.1.0-beta.2`

## Troubleshooting

### Build Failures

**macOS code signing errors**:
- Beta/stable releases don't require code signing
- If you need signed builds, add signing certificates to repository secrets

**Windows build failures**:
- Check that `electron-builder` dependencies are installed
- Verify `assets/icon.ico` exists

**Linux build failures**:
- Ensure `assets/icon.png` exists
- Check AppImage dependencies in electron-builder config

### Release Already Exists

If a tag already exists:
1. Delete the release from GitHub Releases page
2. Delete the tag: `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`
3. Re-run the workflow

### Version Conflicts

If version in `package.json` doesn't match:
1. Manually update `package.json` version
2. Commit and push to main
3. Re-run stable release workflow with correct version

## CI/CD Pipeline Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Push to main                             │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─→ Unit Tests (Node 20.x, 22.x)
             ├─→ E2E Tests (Chromium, WebKit)
             └─→ Beta Release (Automatic)
                 ├─→ Build macOS (Universal, ARM64, x64)
                 ├─→ Build Windows (x64)
                 └─→ Build Linux (x64)

┌─────────────────────────────────────────────────────────────┐
│              Manual Stable Release Trigger                   │
└────────────┬────────────────────────────────────────────────┘
             │
             └─→ Stable Release (Manual)
                 ├─→ Version bump + Tag
                 ├─→ Build macOS (Universal, ARM64, x64)
                 ├─→ Build Windows (x64)
                 └─→ Build Linux (x64)
```

## Best Practices

1. **Always test beta releases** before triggering stable releases
2. **Write clear commit messages** - they become part of the changelog
3. **Use conventional commits** for better changelogs:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation
   - `chore:` for maintenance
4. **Review generated changelog** in beta releases before stable release
5. **Test on target platforms** after beta release
6. **Use patch releases** for urgent bug fixes
7. **Use minor releases** for new features
8. **Use major releases** sparingly, only for breaking changes

## Download Links

### Latest Stable Release
```
https://github.com/yourusername/kb2midi/releases/latest
```

### Latest Beta Release
```
https://github.com/yourusername/kb2midi/releases
```
(Look for releases marked "Pre-release")

### Specific Version
```
https://github.com/yourusername/kb2midi/releases/tag/vX.Y.Z
```
