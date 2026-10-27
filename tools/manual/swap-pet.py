import pathlib, shutil, sys

root = pathlib.Path(r"D:/Users/User/pet-lab")
cfg = root / "config" / "pet.yaml"
bak = root / "config" / ".swap-backup.yaml"
src_dir = root / "images" / "pet" / "anim"
dst_dir = root / "images" / "pet2" / "anim"

if sys.argv[1] == "apply":
    shutil.copyfile(cfg, bak)

    dst_dir.mkdir(parents=True, exist_ok=True)
    for name in ("idle", "look", "click-happy", "poster"):
        for ext in (".webm", ".webp"):
            f = src_dir / (name + ext)
            if f.exists():
                shutil.copyfile(f, dst_dir / f.name)

    t = cfg.read_text(encoding="utf-8")
    t = t.replace("name: 大肥鱼", "name: 小橘", 1)
    t = t.replace("animDir: /images/pet/anim/", "animDir: /images/pet2/anim/", 1)
    t = t.replace("image: /images/pet/anim/poster.webp", "image: /images/pet2/anim/poster.webp", 1)
    t = t.replace("storageKey: deepseek-pet-v4", "storageKey: xiao-ju-v1", 1)
    t = t.replace("hostId: deepseek-pet", "hostId: xiao-ju", 1)
    t = t.replace("  width: 200\n  height: 177", "  width: 220\n  height: 195", 1)
    t = t.replace("  primary: '#4a8cf7'", "  primary: '#f08a3c'", 1)
    t = t.replace("  primary2: '#7c5cf0'", "  primary2: '#e2603a'", 1)
    t = t.replace("  cyan: '#62d9f5'", "  cyan: '#ffd08a'", 1)
    t = t.replace("  name: 大肥鱼\n  alt: 鲸鱼娘大肥鱼", "  name: 小橘\n  alt: 橘猫小橘", 1)
    t = t.replace('    feed: "🍚"', '    feed: "🐟"', 1)
    t = t.replace('    restore: "🐳"', '    restore: "🐱"', 1)
    t = t.replace("  about: 我是大肥鱼，一只住在博客里的鲸鱼娘。点我、拖我、喂我白米饭，或者随便和我聊聊～",
                  "  about: 我是小橘，一只睡在博客角落的橘猫。点我、拖我、喂我小鱼干，或者随便聊聊～", 1)
    t = t.replace("  sleep: ……（大肥鱼靠着鲸鱼尾巴睡着了）", "  sleep: ……（小橘把尾巴卷起来睡着了）", 1)
    t = t.replace("  firstMeet: 第一次见？我是大肥鱼，住在这个角落里。", "  firstMeet: 第一次见？我是小橘，刚搬来这个角落。", 1)
    cfg.write_text(t, encoding="utf-8")
    print("已切换成「小橘」：名字/目录/id/尺寸/配色/图标/台词")

else:
    shutil.copyfile(bak, cfg)
    bak.unlink()
    shutil.rmtree(root / "images" / "pet2", ignore_errors=True)
    print("已还原 pet.yaml 并清掉 images/pet2")
