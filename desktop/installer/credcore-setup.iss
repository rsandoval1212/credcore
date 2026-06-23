; ═══════════════════════════════════════════════════════════════════════════════
; CredCore — Inno Setup Installer Script
; Instalador profesional con barra de progreso, logo y notificación Windows
; Requiere: Inno Setup 6+ (https://jrsoftware.org/isinfo.php)
; ═══════════════════════════════════════════════════════════════════════════════

#define MyAppName "CredCore"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Ronny Sandoval"
#define MyAppURL "https://wa.me/18494422733"
#define MyAppExeName "CredCore.exe"
#define MyAppDescription "Sistema Profesional de Gestión de Créditos"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=..\electron\resources\license.txt
OutputDir=..\installer-output
OutputBaseFilename=CredCore-Setup-{#MyAppVersion}
SetupIconFile=..\electron\resources\icons\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=120,120
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0

; Imágenes del wizard
WizardImageFile=compiler:WizModernImage-IS.bmp
WizardSmallImageFile=compiler:WizModernSmallImage-IS.bmp

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el &Escritorio"; GroupDescription: "Iconos adicionales:"; Flags: checked
Name: "startupicon"; Description: "Iniciar CredCore con Windows"; GroupDescription: "Inicio automático:"

[Files]
Source: "..\dist\CredCore\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Comment: "{#MyAppDescription}"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Comment: "{#MyAppDescription}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar {#MyAppName} ahora"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\logs"
Type: filesandordirs; Name: "{app}\__pycache__"

[Code]
// ════════════════════════════════════════════════════════════════════════════
// Win32 API para timer de actualización del progreso
// ════════════════════════════════════════════════════════════════════════════
function SetTimer(hWnd: LongWord; nIDEvent, uElapse: LongWord; lpTimerFunc: LongWord): LongWord;
  external 'SetTimer@user32.dll stdcall';
function KillTimer(hWnd: LongWord; nIDEvent: LongWord): LongWord;
  external 'KillTimer@user32.dll stdcall';

// ════════════════════════════════════════════════════════════════════════════
// Variables globales
// ════════════════════════════════════════════════════════════════════════════
var
  ProgressPercent: TNewStaticText;   // Porcentaje grande "42%"
  ProgressStatus: TNewStaticText;    // "Instalando componentes..."
  ProgressFile: TNewStaticText;      // Archivo actual
  ProgressElapsed: TNewStaticText;   // "Tiempo: 1 min 23 seg | 394 de ~940"
  ProgressInfo: TNewGroupBox;        // Cuadro informativo
  ProgressMemo: TNewMemo;            // Detalles del sistema
  InstallStartTick: DWORD;           // Tick de inicio
  ProgressTimerID: LongWord;         // ID del timer
  ProgressLastPct: Integer;          // Último porcentaje mostrado

// ── Helpers ─────────────────────────────────────────────────────────────────
function FormatElapsed(Seconds: Integer): String;
var
  M, S: Integer;
begin
  M := Seconds div 60;
  S := Seconds mod 60;
  if M > 0 then
    Result := Format('%d min %d seg', [M, S])
  else
    Result := Format('%d seg', [S]);
end;

// ════════════════════════════════════════════════════════════════════════════
// Timer callback: se ejecuta cada 200ms durante la instalación
// Lee la barra de progreso nativa y actualiza los controles visuales
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

    // Número grande de porcentaje
    ProgressPercent.Caption := Format('%d%%', [Pct]);

    // Texto descriptivo según la fase
    if Pct < 10 then
      ProgressStatus.Caption := 'Preparando archivos del sistema...'
    else if Pct < 25 then
      ProgressStatus.Caption := 'Instalando motor de backend...'
    else if Pct < 45 then
      ProgressStatus.Caption := 'Copiando interfaz de usuario...'
    else if Pct < 65 then
      ProgressStatus.Caption := 'Instalando componentes Python...'
    else if Pct < 80 then
      ProgressStatus.Caption := 'Instalando librerías del sistema...'
    else if Pct < 95 then
      ProgressStatus.Caption := 'Configurando CredCore...'
    else
      ProgressStatus.Caption := 'Completando instalación...';
  end;

  // Archivo actual (del StatusLabel nativo de Inno Setup)
  CurFile := WizardForm.StatusLabel.Caption;
  if Length(CurFile) > 75 then
    ProgressFile.Caption := '...' + Copy(CurFile, Length(CurFile) - 71, 72)
  else
    ProgressFile.Caption := CurFile;

  // Tiempo y estimación de archivos
  Elapsed := (GetTickCount - InstallStartTick) div 1000;
  if Pct > 0 then
    ProgressElapsed.Caption := Format('Tiempo: %s  |  ~%d de 940 archivos',
      [FormatElapsed(Elapsed), (Pct * 940) div 100])
  else
    ProgressElapsed.Caption := 'Tiempo: ' + FormatElapsed(Elapsed);
end;

// ════════════════════════════════════════════════════════════════════════════
// InitializeWizard — Crea todos los controles visuales personalizados
// ════════════════════════════════════════════════════════════════════════════
procedure InitializeWizard;
begin
  // ── Página de Bienvenida ──────────────────────────────────────────────────
  WizardForm.WelcomeLabel1.Caption := 'Bienvenido a CredCore';
  WizardForm.WelcomeLabel1.Font.Size := 14;
  WizardForm.WelcomeLabel1.Font.Style := [fsBold];
  WizardForm.WelcomeLabel1.Font.Color := $00993300;  // Azul oscuro corporativo

  WizardForm.WelcomeLabel2.Caption :=
    'Este asistente instalará CredCore — Sistema Profesional de ' +
    'Gestión de Créditos en su equipo.' + #13#10 + #13#10 +
    '      Versión:           {#MyAppVersion}' + #13#10 +
    '      Desarrollador:  Ronny Sandoval' + #13#10 +
    '      Soporte:           849-442-2733 (WhatsApp)' + #13#10 + #13#10 +
    'CredCore le permite gestionar préstamos, clientes, cuotas, ' +
    'pagos, reportes financieros y mucho más.' + #13#10 + #13#10 +
    'Se recomienda cerrar todas las aplicaciones antes de continuar.' + #13#10 + #13#10 +
    'Haga clic en Siguiente para continuar con la instalación.';

  // ── Página de Instalación — Controles de progreso ─────────────────────────

  // ① Porcentaje grande centrado
  ProgressPercent := TNewStaticText.Create(WizardForm);
  ProgressPercent.Parent := WizardForm.InstallingPage;
  ProgressPercent.Left := WizardForm.ProgressGauge.Left;
  ProgressPercent.Top := WizardForm.ProgressGauge.Top - 55;
  ProgressPercent.Width := WizardForm.ProgressGauge.Width;
  ProgressPercent.AutoSize := False;
  ProgressPercent.Caption := '0%';
  ProgressPercent.Font.Size := 30;
  ProgressPercent.Font.Style := [fsBold];
  ProgressPercent.Font.Color := $00993300;
  ProgressPercent.Alignment := taCenter;

  // ② Texto de estado
  ProgressStatus := TNewStaticText.Create(WizardForm);
  ProgressStatus.Parent := WizardForm.InstallingPage;
  ProgressStatus.Left := WizardForm.ProgressGauge.Left;
  ProgressStatus.Top := WizardForm.ProgressGauge.Top - 18;
  ProgressStatus.Width := WizardForm.ProgressGauge.Width;
  ProgressStatus.AutoSize := False;
  ProgressStatus.Caption := 'Preparando instalación...';
  ProgressStatus.Font.Size := 9;
  ProgressStatus.Font.Color := clGray;
  ProgressStatus.Alignment := taCenter;

  // ③ Barra de progreso más alta
  WizardForm.ProgressGauge.Height := 30;

  // ④ Archivo actual
  ProgressFile := TNewStaticText.Create(WizardForm);
  ProgressFile.Parent := WizardForm.InstallingPage;
  ProgressFile.Left := WizardForm.ProgressGauge.Left;
  ProgressFile.Top := WizardForm.ProgressGauge.Top + WizardForm.ProgressGauge.Height + 8;
  ProgressFile.Width := WizardForm.ProgressGauge.Width;
  ProgressFile.AutoSize := False;
  ProgressFile.Caption := '';
  ProgressFile.Font.Size := 7;
  ProgressFile.Font.Color := clGray;

  // ⑤ Tiempo transcurrido + contador archivos
  ProgressElapsed := TNewStaticText.Create(WizardForm);
  ProgressElapsed.Parent := WizardForm.InstallingPage;
  ProgressElapsed.Left := WizardForm.ProgressGauge.Left;
  ProgressElapsed.Top := ProgressFile.Top + 18;
  ProgressElapsed.Width := WizardForm.ProgressGauge.Width;
  ProgressElapsed.AutoSize := False;
  ProgressElapsed.Caption := '';
  ProgressElapsed.Font.Size := 8;
  ProgressElapsed.Font.Color := clGray;
  ProgressElapsed.Alignment := taRight;

  // ⑥ Cuadro de información del sistema
  ProgressInfo := TNewGroupBox.Create(WizardForm);
  ProgressInfo.Parent := WizardForm.InstallingPage;
  ProgressInfo.Left := WizardForm.ProgressGauge.Left;
  ProgressInfo.Top := ProgressElapsed.Top + 28;
  ProgressInfo.Width := WizardForm.ProgressGauge.Width;
  ProgressInfo.Height := 80;
  ProgressInfo.Caption := ' Información del Sistema ';
  ProgressInfo.Font.Size := 8;
  ProgressInfo.Font.Style := [fsBold];

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
  ProgressMemo.Lines.Add('  Desarrollador:   Ronny Sandoval');
  ProgressMemo.Lines.Add('  Tamaño aprox:    ~55 MB  (940 archivos)');

  // ── Página Completada ─────────────────────────────────────────────────────
  WizardForm.FinishedHeadingLabel.Caption := '¡Instalación Completada!';
  WizardForm.FinishedLabel.Caption :=
    'CredCore se ha instalado correctamente en su equipo.' + #13#10 + #13#10 +
    'Credenciales de acceso iniciales:' + #13#10 +
    '      Usuario:       admin@credcore.local' + #13#10 +
    '      Contraseña:  AdminCredCore123!' + #13#10 + #13#10 +
    'IMPORTANTE: Cambie la contraseña después del primer inicio.' + #13#10 + #13#10 +
    'Soporte: 849-442-2733 (WhatsApp)' + #13#10 +
    'Haga clic en Finalizar para cerrar el asistente.';
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

    // Actualizar destino en el cuadro info
    ProgressMemo.Lines.Clear;
    ProgressMemo.Lines.Add('  Aplicación:      CredCore v{#MyAppVersion}');
    ProgressMemo.Lines.Add('  Destino:           ' + WizardDirValue);
    ProgressMemo.Lines.Add('  Tamaño aprox:    ~55 MB  (940 archivos)');

    // Iniciar timer cada 200ms
    ProgressTimerID := SetTimer(0, 0, 200, CreateCallback(@OnProgressTimer));
  end;

  if CurPageID = wpFinished then
  begin
    // Detener timer
    if ProgressTimerID <> 0 then
    begin
      KillTimer(0, ProgressTimerID);
      ProgressTimerID := 0;
    end;
  end;
end;

// ════════════════════════════════════════════════════════════════════════════
// Verificar Python al avanzar desde Bienvenida
// ════════════════════════════════════════════════════════════════════════════
function IsPythonInstalled: Boolean;
var
  RC: Integer;
begin
  Result := Exec('cmd.exe', '/c python --version', '', SW_HIDE, ewWaitUntilTerminated, RC);
  Result := Result and (RC = 0);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = wpWelcome then
  begin
    if not IsPythonInstalled then
    begin
      if MsgBox('CredCore necesita Python 3.11 o superior.' + #13#10 +
                '¿Desea continuar de todos modos?' + #13#10 + #13#10 +
                'Descargue Python en: python.org/downloads',
                mbConfirmation, MB_YESNO) = IDNO then
        Result := False;
    end;
  end;
end;

// ════════════════════════════════════════════════════════════════════════════
// Post-instalación: Notificación Toast de Windows
// ════════════════════════════════════════════════════════════════════════════
procedure CurStepChanged(CurStep: TSetupStep);
var
  RC: Integer;
  PSCmd: String;
begin
  if CurStep = ssPostInstall then
  begin
    // Notificación toast de Windows 10/11
    PSCmd :=
      '-ExecutionPolicy Bypass -Command "' +
      'Add-Type -AssemblyName System.Runtime.WindowsRuntime; ' +
      '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; ' +
      '[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null; ' +
      '$xml = ''<toast><visual><binding template=\"ToastGeneric\">' +
      '<text>CredCore — Instalación Completada</text>' +
      '<text>El sistema se instaló exitosamente. ¡Ya puede usar CredCore!</text>' +
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

// Limpiar timer si se cancela o cierra
procedure DeinitializeSetup;
begin
  if ProgressTimerID <> 0 then
  begin
    KillTimer(0, ProgressTimerID);
    ProgressTimerID := 0;
  end;
end;
