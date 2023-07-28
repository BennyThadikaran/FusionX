from DataBuilder.utils import getParagraph, getSentences, getDate
from itertools import cycle


class Posts:

    def __init__(self):

        self.tags = cycle(("TagA", "TagB"))
        self.names = cycle(('John Doe', 'Sam Doe'))
        self.titles = []

    def getBody(self):
        para = getParagraph()

        return {"body": f'<p>{para}</p>'}

    def getTitle(self):
        while title := getSentences(wordCount=4):
            if title in self.titles:
                continue
            break
        return title

    def getPostBody(self, postBodyId):
        title = self.getTitle()
        href = title.replace(" ", "-").lower()

        description = getSentences(sentenceCount=3)

        mod_dt = getDate()

        return {
            "title": title,
            "description": description,
            "href": href,
            "body_id": postBodyId,
            "author": self.names.__next__(),
            "header_image": {
                "image": "770x431/485fc7/fff?text=FusionX",
                "alt_text": "alt text"
            },
            "tags": [self.tags.__next__()],
            "mod_dt": mod_dt
        }
