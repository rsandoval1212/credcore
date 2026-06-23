; ═══════════════════════════════════════════════════════════════════════════════
; CredCore — Inno Setup Installer v1.0.0 — PROFESIONAL
; Instalador Profesional con Logo, Página de Activación y Validación de Licencia
; © 2026 Ronny Sandoval | Soporte: 849-442-2733 (WhatsApp)
; Requiere: Inno Setup 6+
; ═══════════════════════════════════════════════════════════════════════════════

#define MyAppName "CredCore"
#define MyAppVersion "1.3.1"
#define MyAppPublisher "Ronny Sandoval"
#define MyAppURL "https://wa.me/18494422733"
#define MyAppExeName "CredCore.exe"
#define MyAppDescription "Sistema Profesional de Gestión de Créditos"
#define SourcePath ".."

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} v{#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
AppCopyright=© 2026 Ronny Sandoval. Todos los derechos reservados.
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=no
LicenseFile={#SourcePath}\electron\resources\license.txt
OutputDir={#SourcePath}\installer-output
OutputBaseFilename=CredCore-v{#MyAppVersion}-Setup
SetupIconFile={#SourcePath}\credcore.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=120,120
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
SetupLogging=yes
UsePreviousAppDir=yes
CloseApplications=force
CloseApplicationsFilter=CredCore.exe
RestartApplications=no

; Imágenes del wizard: se usan las predeterminadas de Inno Setup 6
; (los archivos WizModernImage-IS.bmp eran de Inno Setup 5 y ya no existen)

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el &Escritorio"; GroupDescription: "Iconos adicionales:"
Name: "startupicon"; Description: "Iniciar CredCore con Windows"; GroupDescription: "Inicio automático:"
Name: "quickstart"; Description: "Mostrar guía rápida después de instalar"; GroupDescription: "Opciones:"

[Files]
Source: "{#SourcePath}\dist\CredCore\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourcePath}\credcore.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\credcore.ico"; Comment: "{#MyAppDescription}"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\credcore.ico"; Comment: "{#MyAppDescription}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar {#MyAppName} ahora"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\logs"
Type: filesandordirs; Name: "{app}\__pycache__"

[Code]
// ════════════════════════════════════════════════════════════════════════════
// Variables globales para instalación
// ════════════════════════════════════════════════════════════════════════════
var
  ProgressPercent: TNewStaticText;
  ProgressStatus: TNewStaticText;
  ProgressFile: TNewStaticText;
  ProgressElapsed: TNewStaticText;
  ProgressInfo: TPanel;
  ProgressMemo: TNewMemo;
  InstallStartTick: DWORD;
  ProgressTimerID: LongWord;
  ProgressLastPct: Integer;

  // Variables para página de activación
  ActivationKeyInput: TEdit;
  ActivationLabel: TLabel;
  MachineIdCaption: TLabel;
  MachineIdEdit: TEdit;
  KeyCaption: TLabel;
  ActivationPage: TWizardPage;
  ActivationValid: Boolean;
  ActivationKeyEntered: String;
  ExistingInstallActivated: Boolean;
  UpdateBackupDir: String;

  // Variables de progreso
  LicenseFile: String;

// ════════════════════════════════════════════════════════════════════════════
// Win32 API para timer
// ════════════════════════════════════════════════════════════════════════════
function SetTimer(hWnd: LongWord; nIDEvent, uElapse: LongWord; lpTimerFunc: LongWord): LongWord;
  external 'SetTimer@user32.dll stdcall';
function KillTimer(hWnd: LongWord; nIDEvent: LongWord): LongWord;
  external 'KillTimer@user32.dll stdcall';
function GetTickCount: DWORD;
  external 'GetTickCount@kernel32.dll stdcall';

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════
function FormatElapsed(Seconds: Integer): String;
var M, S: Integer;
begin
  M := Seconds div 60;
  S := Seconds mod 60;
  if M > 0 then
    Result := Format('%d min %d seg', [M, S])
  else
    Result := Format('%d seg', [S]);
end;

function GetCredCoreDataDir(): String;
begin
  Result := ExpandConstant('{param:DATADIR|}');
  if Result = '' then
    Result := ExpandConstant('{userappdata}\CredCore');
end;

function CopyDirectoryTree(SourceDir, DestDir: String): Boolean;
var
  FindRec: TFindRec;
  SourcePath, DestPath: String;
begin
  Result := True;
  if not DirExists(SourceDir) then
    Exit;
  if not ForceDirectories(DestDir) then
  begin
    Result := False;
    Exit;
  end;

  if FindFirst(AddBackslash(SourceDir) + '*', FindRec) then
  begin
    try
      repeat
        if (FindRec.Name <> '.') and (FindRec.Name <> '..') then
        begin
          SourcePath := AddBackslash(SourceDir) + FindRec.Name;
          DestPath := AddBackslash(DestDir) + FindRec.Name;
          if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then
          begin
            if not CopyDirectoryTree(SourcePath, DestPath) then
              Result := False;
          end
          else if not FileCopy(SourcePath, DestPath, False) then
            Result := False;
        end;
      until not FindNext(FindRec);
    finally
      FindClose(FindRec);
    end;
  end;
end;

function CreatePreUpdateBackup(): Boolean;
var
  DataDir, BackupRoot, Stamp, Manifest: String;
begin
  Result := True;
  DataDir := GetCredCoreDataDir();
  if not DirExists(DataDir) then
    Exit;

  Stamp := GetDateTimeString('yyyymmdd_hhnnss', '-', ':');
  BackupRoot := ExpandConstant('{param:BACKUPDIR|}');
  if BackupRoot = '' then
    BackupRoot := ExpandConstant('{localappdata}\CredCore-Update-Backups');
  UpdateBackupDir := AddBackslash(BackupRoot) + 'v{#MyAppVersion}_' + Stamp;

  Result := CopyDirectoryTree(DataDir, UpdateBackupDir);
  if Result then
  begin
    Manifest :=
      'CredCore update backup' + #13#10 +
      'Version destino: {#MyAppVersion}' + #13#10 +
      'Origen: ' + DataDir + #13#10 +
      'Fecha: ' + GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':') + #13#10;
    SaveStringToFile(AddBackslash(UpdateBackupDir) + 'UPDATE_INFO.txt', Manifest, False);
  end;
end;

// ════════════════════════════════════════════════════════════════════════════
// ID de Máquina — DEBE coincidir con licensing.py de CredCore:
// SHA256(MachineGuid del registro) → primeros 16 hex en mayúsculas → XXXX-XXXX-XXXX-XXXX
// ════════════════════════════════════════════════════════════════════════════
function GetMachineID(): String;
var
  Guid, Hash: String;
begin
  Result := 'No disponible — véalo al abrir CredCore';
  if RegQueryStringValue(HKLM64, 'SOFTWARE\Microsoft\Cryptography', 'MachineGuid', Guid) then
  begin
    Hash := Uppercase(GetSHA256OfString(Guid));
    Result := Copy(Hash, 1, 4) + '-' + Copy(Hash, 5, 4) + '-' +
              Copy(Hash, 9, 4) + '-' + Copy(Hash, 13, 4);
  end;
end;

// ════════════════════════════════════════════════════════════════════════════
// Validar formato de clave de activación
// Formato: XXXX-XXXX-XXXX-XXXX.signaturabase64
// ════════════════════════════════════════════════════════════════════════════
function ValidateActivationKey(Key: String): Boolean;
var
  Parts: TArrayOfString;
begin
  Result := False;

  // Eliminar espacios
  Key := Trim(Key);

  // Verificar que tiene longitud mínima (formato esperado es ~100 caracteres)
  if Length(Key) < 80 then
  begin
    MsgBox('Clave de activación inválida: muy corta. Verifica que copiaste la clave completa.', mbError, MB_OK);
    Exit;
  end;

  // Verificar que contiene el punto separador (payload.firma)
  // NOTA: solo se valida el formato general; la verificación criptográfica
  // completa (firma Ed25519 + vínculo con la máquina) la hace CredCore al abrir.
  if Pos('.', Key) = 0 then
  begin
    MsgBox('Clave de activación inválida: formato incorrecto. Debe contener un punto separador.', mbError, MB_OK);
    Exit;
  end;

  // Si llegó aquí, la clave tiene formato válido (validación completa es en la app)
  Result := True;
  ActivationKeyEntered := Key;
  ActivationValid := True;
end;

// ════════════════════════════════════════════════════════════════════════════
// Timer callback para progreso
// ════════════════════════════════════════════════════════════════════════════
procedure OnProgressTimer(H: LongWord; Msg: LongWord; Event: LongWord; Time: LongWord);
var
  Pct, Elapsed: Integer;
  CurFile: String;
begin
  if WizardForm.ProgressGauge.Max > 0 then
    Pct := (WizardForm.ProgressGauge.Position * 100) div WizardForm.ProgressGauge.Max
  else
    Pct := 0;

  if Pct <> ProgressLastPct then
  begin
    ProgressLastPct := Pct;
    ProgressPercent.Caption := Format('%d%%', [Pct]);

    if Pct < 10 then
      ProgressStatus.Caption := 'Preparando archivos del sistema...'
    else if Pct < 25 then
      ProgressStatus.Caption := 'Instalando motor de backend (Django + Python)...'
    else if Pct < 45 then
      ProgressStatus.Caption := 'Copiando interfaz de usuario profesional...'
    else if Pct < 65 then
      ProgressStatus.Caption := 'Instalando componentes de seguridad y licencias...'
    else if Pct < 80 then
      ProgressStatus.Caption := 'Instalando librerías del sistema...'
    else if Pct < 95 then
      ProgressStatus.Caption := 'Configurando base de datos SQLite...'
    else
      ProgressStatus.Caption := 'Completando instalación...';
  end;

  CurFile := WizardForm.StatusLabel.Caption;
  if Length(CurFile) > 75 then
    ProgressFile.Caption := '...' + Copy(CurFile, Length(CurFile) - 71, 72)
  else
    ProgressFile.Caption := CurFile;

  Elapsed := (GetTickCount - InstallStartTick) div 1000;
  ProgressElapsed.Caption := 'Tiempo: ' + FormatElapsed(Elapsed);
end;

// ════════════════════════════════════════════════════════════════════════════
// InitializeWizard — Crear controles y páginas personalizadas
// ════════════════════════════════════════════════════════════════════════════
procedure InitializeWizard;
var
  LogoImage: TBitmapImage;
begin
  ExistingInstallActivated :=
    FileExists(AddBackslash(GetCredCoreDataDir()) + 'license.dat');
  // ──────────────────────────────────────────────────────────────────────────
  // Página de Bienvenida mejorada
  // ──────────────────────────────────────────────────────────────────────────
  WizardForm.WelcomeLabel1.Caption := 'Bienvenido a CredCore';
  WizardForm.WelcomeLabel1.Font.Size := 16;
  WizardForm.WelcomeLabel1.Font.Style := [fsBold];
  WizardForm.WelcomeLabel1.Font.Color := $00003366;  // Azul corporativo oscuro

  WizardForm.WelcomeLabel2.Caption :=
    'Este asistente instalará CredCore v{#MyAppVersion} — Sistema Profesional de Gestión de Créditos en su equipo.' + #13#10 + #13#10 +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + #13#10 + #13#10 +
    '✓ Gestión completa de préstamos y microfinanzas' + #13#10 +
    '✓ Reportes financieros automáticos' + #13#10 +
    '✓ Sistema de licencias anti-piratería' + #13#10 +
    '✓ Base de datos SQL local (sin internet requerido)' + #13#10 +
    '✓ Interfaz moderna y profesional' + #13#10 + #13#10 +
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + #13#10 + #13#10 +
    'Información de Contacto:' + #13#10 +
    '  Desarrollador: Ronny Sandoval' + #13#10 +
    '  Soporte Técnico: 849-442-2733 (WhatsApp)' + #13#10 + #13#10 +
    'Se recomienda cerrar todas las aplicaciones antes de continuar.';

  // ──────────────────────────────────────────────────────────────────────────
  // NUEVA PÁGINA: Activación de Licencia
  // ──────────────────────────────────────────────────────────────────────────
  ActivationPage := CreateCustomPage(wpLicense,
    'Activación de CredCore',
    'Esta copia requiere una clave de licencia para esta computadora');

  // Instrucciones
  ActivationLabel := TLabel.Create(ActivationPage);
  ActivationLabel.Parent := ActivationPage.Surface;
  ActivationLabel.Left := 0;
  ActivationLabel.Top := 0;
  ActivationLabel.Width := ActivationPage.SurfaceWidth;
  ActivationLabel.Height := 40;
  ActivationLabel.WordWrap := True;
  ActivationLabel.Caption :=
    'CredCore requiere una clave de licencia vinculada a esta computadora.' + #13#10 +
    'Envíe el siguiente ID de Máquina a su proveedor (WhatsApp 849-442-2733) para recibir su clave:';
  ActivationLabel.Font.Size := 10;

  // ID de Máquina (solo lectura, seleccionable para copiar)
  MachineIdCaption := TLabel.Create(ActivationPage);
  MachineIdCaption.Parent := ActivationPage.Surface;
  MachineIdCaption.Left := 0;
  MachineIdCaption.Top := 52;
  MachineIdCaption.Caption := 'ID de esta Máquina:';
  MachineIdCaption.Font.Size := 9;
  MachineIdCaption.Font.Style := [fsBold];

  MachineIdEdit := TEdit.Create(ActivationPage);
  MachineIdEdit.Parent := ActivationPage.Surface;
  MachineIdEdit.Left := 0;
  MachineIdEdit.Top := 70;
  MachineIdEdit.Width := ActivationPage.SurfaceWidth;
  MachineIdEdit.Height := 30;
  MachineIdEdit.ReadOnly := True;
  MachineIdEdit.Font.Size := 13;
  MachineIdEdit.Font.Name := 'Courier New';
  MachineIdEdit.Font.Style := [fsBold];
  MachineIdEdit.Font.Color := $00663300;  // Azul oscuro (BGR)
  MachineIdEdit.Text := GetMachineID();

  // Campo de entrada de clave
  KeyCaption := TLabel.Create(ActivationPage);
  KeyCaption.Parent := ActivationPage.Surface;
  KeyCaption.Left := 0;
  KeyCaption.Top := 112;
  KeyCaption.Caption := 'Clave de Licencia (obligatoria):';
  KeyCaption.Font.Size := 9;
  KeyCaption.Font.Style := [fsBold];

  ActivationKeyInput := TEdit.Create(ActivationPage);
  ActivationKeyInput.Parent := ActivationPage.Surface;
  ActivationKeyInput.Left := 0;
  ActivationKeyInput.Top := 130;
  ActivationKeyInput.Width := ActivationPage.SurfaceWidth;
  ActivationKeyInput.Height := 35;
  ActivationKeyInput.Font.Size := 10;
  ActivationKeyInput.Font.Name := 'Courier New';
  ActivationKeyInput.Hint := 'Pegue aquí la clave de licencia recibida';
  ActivationKeyInput.ShowHint := True;
  ActivationKeyInput.Text := '';

  // ──────────────────────────────────────────────────────────────────────────
  // Página de Instalación — Controles de progreso
  // ──────────────────────────────────────────────────────────────────────────
  ProgressPercent := TNewStaticText.Create(WizardForm);
  ProgressPercent.Parent := WizardForm.InstallingPage;
  ProgressPercent.Left := WizardForm.ProgressGauge.Left;
  ProgressPercent.Top := WizardForm.ProgressGauge.Top - 55;
  ProgressPercent.Width := WizardForm.ProgressGauge.Width;
  ProgressPercent.AutoSize := False;
  ProgressPercent.Caption := '0%';
  ProgressPercent.Font.Size := 36;
  ProgressPercent.Font.Style := [fsBold];
  ProgressPercent.Font.Color := $00003366;
  ProgressPercent.Alignment := taCenter;

  ProgressStatus := TNewStaticText.Create(WizardForm);
  ProgressStatus.Parent := WizardForm.InstallingPage;
  ProgressStatus.Left := WizardForm.ProgressGauge.Left;
  ProgressStatus.Top := WizardForm.ProgressGauge.Top - 18;
  ProgressStatus.Width := WizardForm.ProgressGauge.Width;
  ProgressStatus.AutoSize := False;
  ProgressStatus.Caption := 'Preparando instalación...';
  ProgressStatus.Font.Size := 10;
  ProgressStatus.Font.Color := clGray;
  ProgressStatus.Alignment := taCenter;

  WizardForm.ProgressGauge.Height := 30;

  ProgressFile := TNewStaticText.Create(WizardForm);
  ProgressFile.Parent := WizardForm.InstallingPage;
  ProgressFile.Left := WizardForm.ProgressGauge.Left;
  ProgressFile.Top := WizardForm.ProgressGauge.Top + WizardForm.ProgressGauge.Height + 8;
  ProgressFile.Width := WizardForm.ProgressGauge.Width;
  ProgressFile.AutoSize := False;
  ProgressFile.Caption := '';
  ProgressFile.Font.Size := 8;
  ProgressFile.Font.Color := clGray;

  ProgressElapsed := TNewStaticText.Create(WizardForm);
  ProgressElapsed.Parent := WizardForm.InstallingPage;
  ProgressElapsed.Left := WizardForm.ProgressGauge.Left;
  ProgressElapsed.Top := ProgressFile.Top + 18;
  ProgressElapsed.Width := WizardForm.ProgressGauge.Width;
  ProgressElapsed.AutoSize := False;
  ProgressElapsed.Caption := '';
  ProgressElapsed.Font.Size := 8;
  ProgressElapsed.Font.Color := clGray;
  ProgressElapsed.Alignment := taRightJustify;

  ProgressInfo := TPanel.Create(WizardForm);
  ProgressInfo.Parent := WizardForm.InstallingPage;
  ProgressInfo.Left := WizardForm.ProgressGauge.Left;
  ProgressInfo.Top := ProgressElapsed.Top + 28;
  ProgressInfo.Width := WizardForm.ProgressGauge.Width;
  ProgressInfo.Height := 80;
  ProgressInfo.BevelOuter := bvLowered;
  ProgressInfo.Caption := '';

  ProgressMemo := TNewMemo.Create(WizardForm);
  ProgressMemo.Parent := ProgressInfo;
  ProgressMemo.Left := 10;
  ProgressMemo.Top := 18;
  ProgressMemo.Width := ProgressInfo.Width - 20;
  ProgressMemo.Height := 52;
  ProgressMemo.ReadOnly := True;
  ProgressMemo.TabStop := False;
  ProgressMemo.Color := $00F5F5F5;
  ProgressMemo.BorderStyle := bsNone;
  ProgressMemo.Font.Size := 8;
  ProgressMemo.Lines.Add('  Aplicación:      CredCore v{#MyAppVersion}');
  ProgressMemo.Lines.Add('  Sistema:         Profesional de Gestión de Créditos');
  ProgressMemo.Lines.Add('  Instalación:     100% local — no requiere internet ni Python');

  // ──────────────────────────────────────────────────────────────────────────
  // Página Completada
  // ──────────────────────────────────────────────────────────────────────────
  WizardForm.FinishedHeadingLabel.Caption := '¡Instalación Completada Exitosamente!';
  if ExistingInstallActivated then
    WizardForm.FinishedLabel.Caption :=
      'CredCore se actualizó correctamente a la versión {#MyAppVersion}.' + #13#10 + #13#10 +
      'Se conservaron la base de datos, clientes, préstamos, pagos, documentos,' + #13#10 +
      'logo, configuración y licencia existente.' + #13#10 + #13#10 +
      'Al iniciar, CredCore verificará la base de datos y aplicará las migraciones.'
  else
    WizardForm.FinishedLabel.Caption :=
      'CredCore v{#MyAppVersion} se instaló correctamente.' + #13#10 + #13#10 +
      'La aplicación generará una contraseña administrativa única en el primer inicio.' + #13#10 +
      'Las credenciales se guardarán en el archivo CREDENCIALES_INICIALES.txt' + #13#10 +
      'dentro de la carpeta de datos de CredCore.' + #13#10 + #13#10 +
      'Soporte Técnico: 849-442-2733 (WhatsApp)';
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := ExistingInstallActivated and (PageID = ActivationPage.ID);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  if DirExists(GetCredCoreDataDir()) and not CreatePreUpdateBackup() then
    Result :=
      'No se pudo crear el respaldo previo a la actualización.' + #13#10 +
      'La instalación fue cancelada para proteger los datos existentes.';
end;

// ════════════════════════════════════════════════════════════════════════════
// Eventos de página
// ════════════════════════════════════════════════════════════════════════════
procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpInstalling then
  begin
    InstallStartTick := GetTickCount;
    ProgressLastPct := -1;
    ProgressPercent.Caption := '0%';
    ProgressStatus.Caption := 'Iniciando instalación...';
    ProgressTimerID := SetTimer(0, 0, 200, CreateCallback(@OnProgressTimer));
  end;

  if CurPageID = wpFinished then
  begin
    if ProgressTimerID <> 0 then
    begin
      KillTimer(0, ProgressTimerID);
      ProgressTimerID := 0;
    end;
    if ExistingInstallActivated and (UpdateBackupDir <> '') then
      WizardForm.FinishedLabel.Caption :=
        'CredCore se actualizó correctamente a la versión {#MyAppVersion}.' + #13#10 + #13#10 +
        'Se conservaron la base de datos, clientes, préstamos, pagos, documentos,' + #13#10 +
        'logo, configuración y licencia existente.' + #13#10 + #13#10 +
        'Respaldo previo guardado en:' + #13#10 +
        UpdateBackupDir + #13#10 + #13#10 +
        'Al iniciar, CredCore verificará la base de datos y aplicará las migraciones.';
  end;
end;

// ════════════════════════════════════════════════════════════════════════════
// Validar avance desde página de activación
// ════════════════════════════════════════════════════════════════════════════
function NextButtonClick(CurPageID: Integer): Boolean;
var
  Key: String;
begin
  Result := True;

  // NOTA: No se valida Python en el equipo del cliente — el ejecutable
  // empaquetado con PyInstaller es autocontenido y no requiere Python.

  // Validación de clave de activación — OBLIGATORIA: sin clave no se instala
  if (CurPageID = ActivationPage.ID) and not ExistingInstallActivated then
  begin
    Key := Trim(ActivationKeyInput.Text);

    if Key = '' then
    begin
      MsgBox('Debe ingresar la clave de licencia para continuar con la instalación.' + #13#10 + #13#10 +
             'Envíe el ID de Máquina mostrado en esta pantalla a su proveedor' + #13#10 +
             '(WhatsApp 849-442-2733) para recibir su clave.',
             mbError, MB_OK);
      Result := False;
    end
    else if not ValidateActivationKey(Key) then
      Result := False;
  end;
end;

// ════════════════════════════════════════════════════════════════════════════
// Post-instalación: Guardar clave de activación y notificación
// ════════════════════════════════════════════════════════════════════════════
procedure CurStepChanged(CurStep: TSetupStep);
var
  RC: Integer;
  PSCmd: String;
  ActivationDir: String;
begin
  if CurStep = ssPostInstall then
  begin
    // Si hay clave de activación, guardarla
    if ActivationValid and (ActivationKeyEntered <> '') then
    begin
      ActivationDir := ExpandConstant('{commonappdata}\CredCore');

      if not DirExists(ActivationDir) then
        CreateDir(ActivationDir);

      // Crear archivo de clave temporal (la app lo procesará)
      SaveStringToFile(ActivationDir + '\pending_activation.key', ActivationKeyEntered, False);
    end;

    // Notificación Toast de Windows
    PSCmd :=
      '-ExecutionPolicy Bypass -Command "' +
      'Add-Type -AssemblyName System.Runtime.WindowsRuntime; ' +
      '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; ' +
      '[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null; ' +
      '$xml = ''<toast><visual><binding template=\"ToastGeneric\">' +
      '<text>✓ CredCore v{#MyAppVersion} — Instalación Completada</text>' +
      '<text>El sistema se instaló exitosamente. ¡Ya puedes usar CredCore!</text>' +
      '</binding></visual><audio src=\"ms-winsoundevent:Notification.Default\"/></toast>''; ' +
      '$doc = New-Object Windows.Data.Xml.Dom.XmlDocument; ' +
      '$doc.LoadXml($xml); ' +
      '$toast = New-Object Windows.UI.Notifications.ToastNotification($doc); ' +
      '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier(''CredCore'').Show($toast)"';

    Exec('powershell.exe', PSCmd, '', SW_HIDE, ewNoWait, RC);
  end;
end;

// Confirmar cancelación durante instalación
procedure CancelButtonClick(CurPageID: Integer; var Cancel, Confirm: Boolean);
begin
  if CurPageID = wpInstalling then
    Confirm := True;
end;

// Limpiar timer si se cancela
procedure DeinitializeSetup;
begin
  if ProgressTimerID <> 0 then
  begin
    KillTimer(0, ProgressTimerID);
    ProgressTimerID := 0;
  end;
end;
