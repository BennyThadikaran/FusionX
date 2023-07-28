from random import randint
from itertools import cycle
from DataBuilder.utils import getSentences, generateAlphaNumCode, getParagraph


class Products:
    def __init__(self):
        self.codes = []
        self.variant_count = 3
        self.brands = cycle(("FooBar", "BarBaz"))
        self.materials = cycle(("Foo", "Bar"))
        self.countries = cycle(("India", "China"))
        self.colors = cycle(("Red", "Green"))
        self.colors_hex = {
            "Red": "8c1919",
            "Green": "009966"
        }

    @staticmethod
    def getTitle():
        return getSentences(wordCount=3, sentenceCount=1)

    def getInfo(self):
        para = getParagraph()

        return {"info": f'<p>{para}</p>'}

    def getCode(self, category):
        while code := category + generateAlphaNumCode(count=6):
            if code in self.codes:
                continue
            break
        return code

    def getProduct(self, category):
        self.brand = self.brands.__next__()
        self.title = self.getTitle()
        self.code = self.getCode(category)
        self.variant_types = self.buildVariantTypes(self.variant_count)

        self.hrefs = self.buildVariantLinks(self.code,
                                            self.title,
                                            self.variant_count)

        self.product_title = f"{self.brand} {self.title}"

        return {
            "title": self.title,
            "product_code": self.code,
            "href": self.hrefs[0],
        }

    def getVariants(self, infoId):
        variants = []
        for i in range(1, self.variant_count + 1):
            variants.append(self._variant(i, infoId))
        return variants

    def _variant(self, variant_num: int, info_id):

        self.brand = self.brands.__next__()
        self.material = self.materials.__next__()
        self.country = self.countries.__next__()
        self.color = self.colors.__next__()
        price = randint(200, 1000)
        idx = variant_num - 1
        variant = self.variant_types[idx]

        specs = self.buildSpecs()
        title = "{} {} {} {} {}".format(self.brand,
                                        variant['v'],
                                        self.color,
                                        self.material,
                                        self.country)

        return {
            "sku": self.hrefs[idx].split("/")[0],
            "href": self.hrefs[idx],
            "title": title,
            "price": price,
            "mrp": price + 40,
            "gst": 18,
            "qty": 20,
            "type": [variant],
            "specs": specs,
            "other_specs": {
                "weight": "680 grams",
                "dimensions": " 45.7 x 15.2 x 15.2 cms"
            },
            "images": self.buildImages(self.color),
            "z_index": 1 if variant_num == 1 else 0.5,
            "info_id": info_id,
        }

    def buildImages(self, color: str, count=5):
        images = []

        for i in range(1, count):
            images.append([
                f"{self.colors_hex[color]}/fff?text={i}&font=roboto",
                f"image {i}"
            ])

        return images

    def buildVariantLinks(self, product_code, title, count):
        hrefs = []
        title = title.replace(' ', '-').lower()

        for i in range(1, count + 1):
            hrefs.append(f"{product_code}{str(i).zfill(3)}/{title}")

        return hrefs

    def buildSpecs(self):
        dct = {
            "brand": self.brand,
            "origin": self.country,
            "material": self.material,
            "basecolor": self.color
        }

        specs = []

        for k, v in dct.items():
            specs.append({'k': k, 'v': v})

        return specs

    def buildVariantTypes(self, typeCount: int):
        types = ("Foo", "Bar", "Baz")

        lst = []

        for i in range(typeCount):
            lst.append({"k": "type", "v": types[i]})

        return lst
