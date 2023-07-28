from Model import Model
from pathlib import Path
from DataBuilder.Posts import Posts
from DataBuilder.Products import Products

DIR = Path(__file__).parent
ENV_PATH = (DIR / '../../src/.env').resolve()

# connect the db
model = Model(env_path=ENV_PATH)
db = model.connect(dbName="fusionx_test")

# Initialise Posts class
posts = Posts()

# insert blog post body into Db
result = db.post_body.insert_one(posts.getBody())

# Collate and insert blog posts into Db
db.posts.insert_many([
    posts.getPostBody(result.inserted_id) for _ in range(20)
])

# Initialise the Products Class
products = Products()

categories = ("efacfr", "camxts", "cawxts")

product_docs = []
variant_docs = []

result = db.variant_info.insert_one(products.getInfo())

for category in categories:
    for i in range(20):
        product = products.getProduct(category)
        product_docs.append(product)

        variant_docs += products.getVariants(result.inserted_id)

db.products.insert_many(product_docs)
db.product_variants.insert_many(variant_docs)

db.users.insert_one({
    "fname": "John",
    "lname": "Test",
    "email": "john@example.com",
    "hash": "$2b$10$zzULnU02hvJt1IcDKxDbFu/9AjGufGGekMCXUO4QADJ8YXmlR7rXa"
})

model.con.close()
