#!/usr/bin/env python3
# Сборка страницы приложения в один файл.
#   python3 bundle.py <папка fieldmap2>
# Из исходников fieldmap2/web/ (index.html от port.py, js/*.js, version.json) делает то, что попадает в APK:
#   app/src/main/assets/web/index.html   — загрузчик (loader.html)
#   app/src/main/assets/web/app.html     — вся страница одним файлом (скрипты js/ вставлены внутрь) + версия FM_WEB
#   app/src/main/assets/web/version.json — версия встроенной страницы (читает MainActivity)
# Тот же app.html выкладывается как обновление без APK (web.html в релизе, см. manifest.py).
import json
import os
import re
import shutil
import sys

root = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(root, 'web')
dst = os.path.join(root, 'app', 'src', 'main', 'assets', 'web')

ver = json.load(open(os.path.join(src, 'version.json'), encoding='utf-8'))
assert isinstance(ver.get('web'), int) and ver['web'] > 0 and ver.get('name'), 'version.json: нужны web (число) и name'
gradle = open(os.path.join(root, 'app', 'build.gradle'), encoding='utf-8').read()
code = int(re.search(r'versionCode\s+(\d+)', gradle).group(1))
assert ver.get('minApk', 0) <= code, 'version.json: minApk больше versionCode в build.gradle'

html = open(os.path.join(src, 'index.html'), encoding='utf-8').read()
tags = re.findall(r'<script src="(js/[\w.-]+)"></script>', html)
assert tags, 'в странице нет <script src="js/…">'
for i, t in enumerate(tags):
    js = open(os.path.join(src, t), encoding='utf-8').read()
    assert '</script' not in js.lower(), t + ': внутри есть </script>'
    block = '<script>\n' + js.rstrip('\n') + '\n</script>'
    if i == 0:   # версия страницы — перед первым скриптом
        block = '<script>window.FM_WEB = ' + json.dumps({'v': ver['web'], 'name': ver['name']}, ensure_ascii=False) + ';</script>\n' + block
    tag = '<script src="%s"></script>' % t
    assert html.count(tag) == 1, tag
    html = html.replace(tag, block)
assert 'src="js/' not in html

if os.path.isdir(dst):
    shutil.rmtree(dst)
os.makedirs(dst)
open(os.path.join(dst, 'app.html'), 'w', encoding='utf-8').write(html)
shutil.copy(os.path.join(here, 'loader.html'), os.path.join(dst, 'index.html'))
shutil.copy(os.path.join(src, 'version.json'), os.path.join(dst, 'version.json'))
print('ok: web %d (%s), app.html %d байт' % (ver['web'], ver['name'], len(html.encode('utf-8'))))
