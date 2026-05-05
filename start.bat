@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  血液透析分层分级护理系统
echo  浏览器请打开: http://127.0.0.1:3081
echo  默认管理员: admin / admin （登录后请尽快修改密码）
echo.

echo  正在启动服务，请保持此窗口不要关闭...
echo.
node server.js

