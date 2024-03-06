# cloudflare-whisper

## index.html to string

```zsh
sed 's/"/\\"/g' index.html | tr -d '\n' | awk '{print "export const html = \""$0"\";"}' > src/html.ts
```
