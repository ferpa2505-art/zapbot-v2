; ZapBot - Customizações do instalador NSIS
; Este arquivo é incluído automaticamente pelo electron-builder

!macro customHeader
  !system "echo Gerando instalador ZapBot..."
!macroend

!macro customInit
  ; Verifica instalação anterior e remove
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\ZapBot" "UninstallString"
  StrCmp $R0 "" done
  MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
    "ZapBot já está instalado. Clique OK para remover a versão anterior antes de instalar a nova." \
    IDOK uninst
  Abort
  uninst:
    ExecWait '$R0 /S'
  done:
!macroend

!macro customInstall
  ; Cria pasta de dados do usuário
  CreateDirectory "$APPDATA\ZapBot"
!macroend

!macro customUnInstall
  ; Pergunta se quer apagar configurações ao desinstalar
  MessageBox MB_YESNO "Deseja apagar também as configurações e sessões salvas?" IDNO skip
    RMDir /r "$APPDATA\ZapBot"
  skip:
!macroend
