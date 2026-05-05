#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Converts a directory of SVG icons into an Iconify-format JSON icon pack.

.DESCRIPTION
    The output JSON follows the Iconify icon set format:
      { prefix, icons: { name: { body, width, height } } }

    Icon names are derived from filenames:
      "10021-icon-service-Virtual-Machine.svg" -> "virtual-machine"

.PARAMETER IconsDir
    Path to the directory containing SVG files (searched recursively).

.PARAMETER Prefix
    The icon set prefix (e.g. "azure").

.PARAMETER OutputFile
    Optional output file path. Defaults to "<prefix>-icons.json" in the current directory.

.EXAMPLE
    ./scripts/build-icon-pack.ps1 -IconsDir ~/Downloads/Azure_Public_Service_Icons-3/Icons -Prefix azure

.EXAMPLE
    ./scripts/build-icon-pack.ps1 ~/Downloads/Icons azure azure-icons.json
#>

param(
    [Parameter(Mandatory, Position = 0)]
    [string]$IconsDir,

    [Parameter(Mandatory, Position = 1)]
    [string]$Prefix,

    [Parameter(Position = 2)]
    [string]$OutputFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$IconsDir = Resolve-Path $IconsDir

if (-not $OutputFile) {
    $OutputFile = Join-Path (Get-Location) "$Prefix-icons.json"
} else {
    $OutputFile = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputFile)
}

function Parse-Svg([string]$svg) {
    $bodyMatch = [regex]::Match($svg, '<svg[^>]*>([\s\S]*)</svg>', 'IgnoreCase')
    $body = if ($bodyMatch.Success) { $bodyMatch.Groups[1].Value.Trim() } else { '' }

    $wMatch = [regex]::Match($svg, '<svg[^>]*\swidth="([\d.]+)"', 'IgnoreCase')
    $hMatch = [regex]::Match($svg, '<svg[^>]*\sheight="([\d.]+)"', 'IgnoreCase')

    if ($wMatch.Success -and $hMatch.Success) {
        return @{
            body   = $body
            width  = [math]::Round([double]$wMatch.Groups[1].Value)
            height = [math]::Round([double]$hMatch.Groups[1].Value)
        }
    }

    $vbMatch = [regex]::Match($svg, '<svg[^>]*\sviewBox="[\d.]+\s[\d.]+\s([\d.]+)\s([\d.]+)"', 'IgnoreCase')
    if ($vbMatch.Success) {
        return @{
            body   = $body
            width  = [math]::Round([double]$vbMatch.Groups[1].Value)
            height = [math]::Round([double]$vbMatch.Groups[2].Value)
        }
    }

    return @{ body = $body; width = 24; height = 24 }
}

function Slugify([string]$filename) {
    $name = [System.IO.Path]::GetFileNameWithoutExtension($filename)
    $name = $name -replace '^\d+-icon-service-', ''
    $name = $name -replace '^\d+-', ''
    $name = $name.ToLower() -replace '[^a-z0-9]+', '-' -replace '^-|-$', ''
    return $name
}

# Collect all SVG files recursively
$svgFiles = Get-ChildItem -Path $IconsDir -Filter '*.svg' -Recurse -File
Write-Host "Found $($svgFiles.Count) SVG files in $IconsDir"

$icons = [ordered]@{}
$seen = [System.Collections.Generic.HashSet[string]]::new()

foreach ($file in $svgFiles) {
    $svg = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    $name = Slugify $file.Name

    # Deduplicate: if same name appears in multiple categories, prefix with category
    if ($seen.Contains($name)) {
        $category = Slugify $file.Directory.Name
        $name = "$category-$name"
    }
    [void]$seen.Add($name)

    $parsed = Parse-Svg $svg
    if ($parsed.body) {
        $icons[$name] = $parsed
    }
}

$pack = @{ prefix = $Prefix; icons = $icons }
$json = $pack | ConvertTo-Json -Depth 4 -Compress
[System.IO.File]::WriteAllText($OutputFile, $json, [System.Text.Encoding]::UTF8)

Write-Host "Wrote $($icons.Count) icons to $OutputFile"
Write-Host ""
Write-Host "To use in your previewer, add to settings.json:"
Write-Host "  `"mermaidPreview.iconPacks`": [`"file://$OutputFile`"]"
Write-Host ""
Write-Host "Or host the file and use an http(s) URL."
