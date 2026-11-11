# Ejecutar personalmente en PowerShell. No imprime ni copia contraseñas automáticamente.
$ErrorActionPreference='Stop'
try {
 Add-Type -AssemblyName System.Security
 Add-Type -AssemblyName System.Windows.Forms
 Add-Type -AssemblyName System.Drawing
 $path=Join-Path $env:LOCALAPPDATA 'DentaIA\credenciales\fase8\cuentas-y-lote.json.dpapi'
 $plain=[System.Security.Cryptography.ProtectedData]::Unprotect([System.IO.File]::ReadAllBytes($path),$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)
 $vault=[System.Text.Encoding]::UTF8.GetString($plain)|ConvertFrom-Json
 $form=New-Object System.Windows.Forms.Form
 $form.Text='DentaIA - Credenciales academicas privadas';$form.Width=610;$form.Height=275;$form.StartPosition='CenterScreen'
 $combo=New-Object System.Windows.Forms.ComboBox;$combo.Left=20;$combo.Top=20;$combo.Width=550;$combo.DropDownStyle='DropDownList'
 foreach($account in $vault.accounts){[void]$combo.Items.Add($account.alias)}
 $email=New-Object System.Windows.Forms.TextBox;$email.Left=20;$email.Top=65;$email.Width=550;$email.ReadOnly=$true
 $password=New-Object System.Windows.Forms.TextBox;$password.Left=20;$password.Top=105;$password.Width=550;$password.ReadOnly=$true;$password.UseSystemPasswordChar=$true
 $totp=New-Object System.Windows.Forms.TextBox;$totp.Left=20;$totp.Top=145;$totp.Width=550;$totp.ReadOnly=$true;$totp.UseSystemPasswordChar=$true
 $show=New-Object System.Windows.Forms.CheckBox;$show.Left=20;$show.Top=185;$show.Width=550;$show.Text='Mostrar credenciales solo en esta pantalla privada'
 $combo.Add_SelectedIndexChanged({$a=$vault.accounts[$combo.SelectedIndex];$email.Text=$a.email;$password.Text=$a.password;$totp.Text=if($a.totpSecret){$a.totpSecret}else{''}})
 $show.Add_CheckedChanged({$password.UseSystemPasswordChar=-not $show.Checked;$totp.UseSystemPasswordChar=-not $show.Checked})
 $form.Controls.AddRange(@($combo,$email,$password,$totp,$show));$combo.SelectedIndex=0
 [void]$form.ShowDialog();$password.Text='';$totp.Text='';$plain=$null;$vault=$null
} catch { [System.Windows.Forms.MessageBox]::Show('No se pudo abrir el almacen privado. Usa el mismo usuario Windows que aprovisiono las cuentas.','DentaIA')|Out-Null }
