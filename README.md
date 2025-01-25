# ![icon](icons/icon32.png) WikiFaves

## Description

WikiFaves is a Chrome extension that allows you to save and manage your favorite
Wikipedia pages. The extension adds a button to Wikipedia pages that allows you
to save the page as a favorite (or remove it from your favorites).

I developed it as a test project because I wanted to experiment with
using AI for coding. I chose this project in particular because I like the
bookmarking feature on the Wikipedia mobile app and wish that
the website had a similar feature.

In addition to keeping a list of your favorite pages, it also keeps a history of
the pages you've visited on Wikipedia.

Favorites are synced across all instances of Chrome that you're logged into,
while history is only kept locally on the device.

Data import/export is supported (as a JSON file).


## Icons

Here is the code that was used to generate the icons. It uses ImageMagick and
assumes the Bodoni font is available on the system.

```
magick -size 128x128 xc:transparent -fill gold -draw "polygon 64,0 85,43 128,48 96,80 104,128 64,104 24,128 32,80 0,48 43,43" -fill black -font "Bodoni-72-Book" -pointsize 80 -gravity center -draw "text 0,15 'W'" icons/icon128.png

magick icons/icon128.png -resize 16x16 icons/icon16.png
magick icons/icon128.png -resize 32x32 icons/icon32.png
magick icons/icon128.png -resize 48x48 icons/icon48.png
```
