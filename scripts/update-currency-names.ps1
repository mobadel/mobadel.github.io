$ErrorActionPreference = "Stop"

$pricePageUrl = "https://nobitex.ir/price/"
$marketStatsUrl = "https://apiv2.nobitex.ir/market/stats"
$outputPath = Join-Path (Split-Path $PSScriptRoot -Parent) "data/currencies.json"

$page = curl.exe -sL --max-time 30 --compressed $pricePageUrl
$statsText = curl.exe -sL --max-time 30 --compressed $marketStatsUrl

if (-not $page -or -not $statsText) {
  throw "Nobitex public data could not be downloaded."
}

$stats = $statsText | ConvertFrom-Json
$activeSymbols = [System.Collections.Generic.HashSet[string]]::new()

foreach ($key in $stats.stats.PSObject.Properties.Name) {
  if ($key -eq "global" -or -not $key.Contains("-")) { continue }

  $separator = $key.LastIndexOf("-")
  [void]$activeSymbols.Add($key.Substring(0, $separator).ToLowerInvariant())

  $quote = $key.Substring($separator + 1).ToLowerInvariant()
  if ($quote -ne "rls") { [void]$activeSymbols.Add($quote) }
}

$pattern = '\\"name\\":\\"(?<name>[^\\"]+)\\",\\"symbol\\":\\"(?<symbol>[^\\"]+)\\",\\"altSymbol\\":(?:(?:\\"(?<alt>[^\\"]*)\\")|null),\\"faName\\":\\"(?<fa>[^\\"]+)\\"'
$matches = [regex]::Matches($page, $pattern)
$pageNames = @{}

foreach ($match in $matches) {
  $symbol = $match.Groups["symbol"].Value.ToLowerInvariant()
  if ($pageNames.ContainsKey($symbol)) { continue }

  $pageNames[$symbol] = [ordered]@{
    fa = $match.Groups["fa"].Value.Trim()
    en = $match.Groups["name"].Value.Trim()
    alt = $match.Groups["alt"].Value.Trim()
  }
}

# These legacy market symbols are present in market/stats but do not have a
# dedicated entry on the public price page.
$pageNames["gala"] = [ordered]@{ fa = "گالا"; en = "Gala"; alt = "" }
$pageNames["pgala"] = [ordered]@{ fa = "گالای پگ‌شده"; en = "PeggedGala"; alt = "" }
$pageNames["nxt20"] = [ordered]@{ fa = "شاخص کل نوبیتکس"; en = "Nobitex Total"; alt = "" }

$currencies = [ordered]@{
  irt = [ordered]@{ fa = "تومان"; en = "Toman"; alt = "ریال" }
}

foreach ($symbol in ($activeSymbols | Sort-Object)) {
  if ($pageNames.ContainsKey($symbol)) {
    $currencies[$symbol] = $pageNames[$symbol]
  }
}

$payload = [ordered]@{
  source = $pricePageUrl
  updated = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  currencies = $currencies
}

$json = $payload | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($outputPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))

Write-Output "Wrote $($currencies.Count) currency names to $outputPath"
