param(
  [Parameter(Mandatory=$true)][ValidateSet('Protect','Unprotect')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$Path
)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
if ($Mode -eq 'Protect') {
  $inputStream=[Console]::OpenStandardInput()
  $memory=New-Object System.IO.MemoryStream
  $inputStream.CopyTo($memory)
  $protected=[System.Security.Cryptography.ProtectedData]::Protect($memory.ToArray(),$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)
  [System.IO.File]::WriteAllBytes($Path,$protected)
  $memory.Dispose()
} else {
  $bytes=[System.Security.Cryptography.ProtectedData]::Unprotect([System.IO.File]::ReadAllBytes($Path),$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)
  [Console]::OpenStandardOutput().Write($bytes,0,$bytes.Length)
}
