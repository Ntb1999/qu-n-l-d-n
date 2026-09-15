@echo off
chcp 65001 >nul
title Đồng Bộ Jira FSS - SBSI UAT Command Portal
cls
echo ===============================================================================
echo   🏛️  ĐỒNG BỘ DỮ LIỆU ISSUE TỪ JIRA FSS (PROJECT: SBSIUAT)
echo ===============================================================================
echo.
echo   Dang ket noi Jira FSS (https://projects.fss.com.vn)...
echo.
python "%~dp0sync_jira_fss.py"
echo.
echo ===============================================================================
echo   ✅ HOÀN TẤT ĐỒNG BỘ! Hãy mở hoặc tải lại (F5) trang UAT Command Portal.
echo ===============================================================================
echo.
pause
