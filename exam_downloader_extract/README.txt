试卷下载器 - 电脑版使用说明 (已打包成品)
============================================

【这是什么】
把手机 App 里的试卷批量下载到电脑, 每份试卷独立文件夹,
可一键合成 PDF 直接打印。仅限个人账号自用, 请勿外传/二次分发。

【开箱即用, 不用装 Python】
本包里的 paper_batch.exe 已经打包完成, 登录 token 也已内置,
双击即可直接使用, 无需安装 Python、无需再抓包粘贴 token。

  第 1 步: 双击 paper_batch.exe
  第 2 步: 直接按菜单数字操作 (见下)

下载好的试卷在 exe 同目录的 papers\ 文件夹里。

【菜单说明】
  1 = 按条件批量下载 (年级/科目/年份/名校市重点)
  2 = 按名字搜索并下载 (像搜索引擎一样)
  3 = 按试卷 ID 下载
  4 = 已下载的试卷合成 PDF
  q = 退出

【关于 token】
- 程序内置了你的登录 token, 首次运行会自动保存为 exe 同目录 token.txt。
- 内置 token 有效期至 2027-01-09。
- 过期或失效时 (提示 401 / token 过期), 重新抓包拿新 token:
  1. 手机装 ProxyPin, 开启 HTTPS 抓包, 打开 App 进一次试卷列表
  2. 找 papers/list 请求 -> 请求头 -> 复制 Authorization 的值
  3. 粘贴到程序提示处, 或直接改写 exe 同目录 token.txt 后重开

【常见问题】
- 提示 token 过期 / 401: 按上面方法换新 token
- 提示会员拦截(50000): 该内容需要 App 内会员, 有会员的账号才抓得到
- 双击 exe 闪退: 在 cmd 里拖入 exe 回车运行, 看具体报错
- 杀毒软件误报: PyInstaller 打包的程序偶被误报, 选择信任即可

【给维护者: 如何重新打包】 (普通用户可忽略)
  双击 build.bat 即可 (需先安装 Python 并勾选 Add to PATH),
  或手动执行:
    python -m pip install requests pillow pyinstaller
    python -m PyInstaller --onefile --console --name paper_batch paper_batch_pc.py
  token 内嵌位置: 源码顶部 DEFAULT_TOKEN 常量。

文件清单:
  paper_batch.exe     双击即用的成品程序 (含内置 token)
  paper_batch_pc.py   程序源码 (含内置 token)
  build.bat           一键重新打包脚本
  requirements.txt    依赖列表
