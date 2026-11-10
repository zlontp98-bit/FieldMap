#!/usr/bin/env python3
# Описание обновления для приложения (запускается в GitHub Actions после сборки APK).
#   python3 manifest.py <папка fieldmap2> <FieldMap.apk> <тег релиза: latest | stable> <commit>
# Пишет в текущую папку web.html (страница приложения, копия assets/web/app.html) и update.json.
# Приложение читает update.json из релиза (stable — для всех, latest — пробные версии) и предлагает «Обновить»:
# web — новая страница без APK; apk — новый APK, если странице нужна более новая оболочка (minApk) или apkPush.
import datetime
import hashlib
import json
import os
import re
import shutil
import sys

root, apk, tag, commit = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
assert tag in ('latest', 'stable'), tag
base = 'https://github.com/zlontp98-bit/FieldMap/releases/download/%s/' % tag
web = os.path.join(root, 'app', 'src', 'main', 'assets', 'web')
ver = json.load(open(os.path.join(web, 'version.json'), encoding='utf-8'))
gradle = open(os.path.join(root, 'app', 'build.gradle'), encoding='utf-8').read()
code = int(re.search(r'versionCode\s+(\d+)', gradle).group(1))
name = re.search(r'versionName\s+"([^"]+)"', gradle).group(1)


def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


shutil.copy(os.path.join(web, 'app.html'), 'web.html')
assert ('window.FM_WEB = ' + json.dumps({'v': ver['web'], 'name': ver['name']}, ensure_ascii=False)) in open('web.html', encoding='utf-8').read(), \
    'app.html собран не из этой version.json — запустите bundle.py'
out = {
    'format': 1,
    'channel': tag,
    'built': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'commit': commit,
    'web': {'version': ver['web'], 'name': ver['name'], 'url': base + 'web.html', 'sha256': sha('web.html'),
            'size': os.path.getsize('web.html'), 'minApk': ver.get('minApk', 0)},
    'apk': {'versionCode': code, 'versionName': name, 'url': base + 'FieldMap.apk', 'sha256': sha(apk),
            'size': os.path.getsize(apk), 'push': bool(ver.get('apkPush'))},
    'minWeb': ver.get('minWeb', 0),
    'notes': ver.get('notes', {}),
}
json.dump(out, open('update.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1))
