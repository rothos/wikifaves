To generate the icons:

```
magick -size 128x128 xc:transparent -fill yellow -draw "polygon 64,0 85,43 128,48 96,80 104,128 64,104 24,128 32,80 0,48 43,43" -fill black -font "Bodoni-72-Book" -pointsize 80 -gravity center -draw "text 0,15 'W'" icons/icon128.png

magick icons/icon128.png -resize 16x16 icons/icon16.png && magick icons/icon128.png -resize 48x48 icons/icon48.png
```
