import pathlib

p = pathlib.Path(r"D:/Users/user/pet-lab/config-editor.html")
t = p.read_text(encoding="utf-8")

# 「身份」这一段的说明是拼接出来的，T() 只包住了第三段，
# 前两段（含链接文字「文案编辑」）仍是中文。改成整句走字典。
old = """        desc: '它在对话里怎么称呼自己，以及状态存在哪个键下面。' +
              '她说的话不在这一页，去 <a href="copy-editor.html">文案编辑</a>；' +
              T('那边的每一条都支持 {pet} 等占位符（名字、时间、标题、标签……），改名字会自动跟着变。'),"""

new = """        desc: T('它在对话里怎么称呼自己，以及状态存在哪个键下面。' +
              '她说的话不在这一页，去 <a href="copy-editor.html">文案编辑</a>；' +
              '那边的每一条都支持 {pet} 等占位符（名字、时间、标题、标签……），改名字会自动跟着变。'),"""

assert old in t, "身份 desc 锚点"
t = t.replace(old, new, 1)
p.write_text(t, encoding="utf-8")
print("身份说明已整句走字典")
