import shutil, pathlib, sys

root = pathlib.Path(r"D:/Users/User/pet-lab")
src = root / "config" / "pet.yaml"
bak = root / "config" / ".port-backup.yaml"

mode = sys.argv[1] if len(sys.argv) > 1 else "apply"

if mode == "apply":
    shutil.copyfile(src, bak)
    t = src.read_text(encoding="utf-8")
    t = t.replace("name: 大肥鱼", "name: 小橘", 1)
    t = t.replace("animDir: /images/pet/anim/", "animDir: /images/pet2/anim/", 1)
    t = t.replace("image: /images/pet/anim/poster.webp", "image: /images/pet2/anim/poster.webp", 1)
    t = t.replace("storageKey: deepseek-pet-v4", "storageKey: test-pet-v1", 1)
    src.write_text(t, encoding="utf-8")
    print("已改成「小橘」：name / animDir / image / storageKey")
else:
    shutil.copyfile(bak, src)
    bak.unlink()
    print("已还原 pet.yaml")
