# cloudflare-whisper

## index.html to string

```zsh
cat index.html | sed 's/"/\\"/g' | tr -d '\n' > out.txt
```
