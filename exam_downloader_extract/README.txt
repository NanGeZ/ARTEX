试卷下载器 - 电脑版使用说明 (图形界面成品)
============================================

【这是什么】
把手机 App 里的试卷批量下载到电脑, 每份试卷独立文件夹,
可一键合成 PDF 直接打印。仅限个人账号自用, 请勿外传/二次分发。

【开箱即用, 不用装 Python】
本包里的 试卷下载器.exe 已经打包完成, 登录 token 也已内置,
双击弹出图形窗口即可直接使用, 无需安装 Python、无需抓包粘贴 token。

  第 1 步: 双击 试卷下载器.exe
  第 2 步: 在窗口里选条件 -> 点"搜索" -> 点"下载选中"

下载好的试卷在 exe 同目录的 papers\ 文件夹里。

【界面说明】
  顶部        标题 + token 有效期状态
  筛选区      年级/科目/年份/卷型/学期/地区 下拉框, 名称关键词输入框
  搜索        按下拉条件筛选 (关键词留空) 或按名字搜索 (填关键词)
  下载选中    下载列表中勾选的试卷; 一条都不选 = 全部下载
  试卷列表    搜索结果 (名称/打印量/级别), 支持多选 (Ctrl/Shift)
  下载后生成PDF   勾选后每下完一份自动合成 PDF
  全部合成PDF     把 papers\ 里已下载的试卷全部合成 PDF
  打开文件夹      直接打开 papers\ 输出目录
  进度条/日志区   实时显示下载进度和运行日志

【关于 token】
- 程序内置了登录 token, 首次运行会自动保存为 exe 同目录 token.txt。
- 内置 token 有效期至 2027-01-09 (窗口右上角有显示)。
- 过期或失效时 (日志提示 401 / token 过期), 重新抓包拿新 token:
  1. 手机装 ProxyPin, 开启 HTTPS 抓包, 打开 App 进一次试卷列表
  2. 找 papers/list 请求 -> 请求头 -> 复制 Authorization 的值
  3. 用记事本改写 exe 同目录 token.txt 后重开程序

【常见问题】
- 提示 token 过期 / 401: 按上面方法换新 token
- 提示会员拦截(50000): 该内容需要 App 内会员, 有会员的账号才抓得到
- 双击 exe 没反应/闪退: 在 cmd 里拖入 exe 回车运行, 看具体报错
- 杀毒软件误报: PyInstaller 打包的程序偶被误报, 选择信任即可
- 下载慢/卡住: 属正常逐页下载, 看进度条和日志区即可

【给维护者: 如何重新打包】 (普通用户可忽略)
  双击 build.bat 即可 (需先安装 Python 并勾选 Add to PATH),
  或手动执行:
    python -m pip install requests pillow pyinstaller
    python -m PyInstaller --onefile --windowed --name 试卷下载器 paper_batch_gui.py
  token 内嵌位置: paper_batch_pc.py 顶部 DEFAULT_TOKEN 常量。

文件清单:
  试卷下载器.exe      图形界面成品 (含内置 token, 双击使用)
  paper_batch.exe     命令行版成品 (备用)
  paper_batch_gui.py  图形界面源码
  paper_batch_pc.py   核心源码 (含内置 token)
  build.bat           一键重新打包脚本
  requirements.txt    依赖列表
