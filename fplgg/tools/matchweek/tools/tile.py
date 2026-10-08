import sys
from PIL import Image
def tile(src, dst, colh=1300, maxcols=4):
    im=Image.open(src).convert('RGB'); w,h=im.size
    im=im.resize((w//2,h//2)); w,h=im.size
    cols=[im.crop((0,y,w,min(h,y+colh))) for y in range(0,h,colh)][:maxcols]
    out=Image.new('RGB',(len(cols)*(w+10),colh),(40,40,40))
    for i,c in enumerate(cols): out.paste(c,(i*(w+10),0))
    out.save(dst); return len(cols), h
if __name__=='__main__':
    for s in sys.argv[1:]:
        import os; d='/home/claude/next-build/qa/v/'+os.path.basename(s)
        print(d, tile(s,d))
