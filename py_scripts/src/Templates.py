from csv import DictReader
from itertools import islice, chain
from bson.objectid import ObjectId
from string import ascii_lowercase, digits
from random import choices


class BaseTemplate:
    '''
    A base class for all product templates

    Child classes must implement:
    type_columns [Required Attribute, Tuple(Strings)]:
        columns names for product variant attributes like size, color etc

    added_specs [Optional Attribute, Tuple(Strings)]:
        Any additional column names to add to spec_columns

    other_added_specs [Optional Attribute, Tuple(Strings)]:
        Any additional column names to add to other_specs_columns

    added_validations [Optional method]:
        Any additional validations to be run on the file
    '''

    parent_columns = ('listing_type', 'brand', 'title',
                      'category_code', 'href', 'image', 'gst')

    child_columns = ('price', 'mrp', 'qty', 'image1', 'image2', 'image3',
                     'image4', 'image5', 'description')

    # Attributes used for filtering products
    spec_columns = ('brand', 'origin', 'material', 'basecolor')

    # attributes that will not be used in filters
    other_spec_columns = ('weight', 'dimensions')

    alpha_num = ascii_lowercase + digits

    type_columns = None
    added_validations = None
    added_specs = None
    other_added_specs = None

    def __init__(self, file, db):
        if not file.is_file():
            exit(f'{file} does not exist')

        self.file = file
        self.db = db

    def __enter__(self):
        self.csv = self.file.open()
        self.reader = DictReader(self.csv, dialect='excel-tab')
        self.length = len(self.reader.fieldnames)
        self.title = ''
        self.brand = ''
        return self

    def __exit__(self, exc_type, exc_value, exc_trace):
        self.csv.close()
        self.db.con.close()

        if exc_type:
            exit(f'{exc_type}: {self.file.name}: {exc_value}: {exc_trace}')
        return True

    def generate_code(self):
        return ''.join(choices(self.alpha_num, k=6))

    def validate_file(self):
        '''Checks if:
        File contains all columns as expected
        No blank row or empty values in parent and child columns
        Has atleast 1 parent row
        Every parent has atleast 1 child row
        On child rows, price <= MRP
        Run the added_validations method defined on the child class
        '''

        columns = self.reader.fieldnames

        if self.type_columns is None:
            raise NotImplementedError(
                f'{self.__class__.__name__} must have a type_columns attribute')

        for column in chain(self.parent_columns, self.child_columns,
                            self.type_columns, self.other_spec_columns):
            if not column in columns:
                raise KeyError(f'{column} column missing from {self.file}')

        # Must have atleast 1 parent listing with listing_type=MAIN
        has_main = False

        has_sub = False

        has_gst_parent = False

        # keep track of row count for error tracking
        count = 2

        for row in self.reader:
            if row['listing_type'] == 'MAIN':
                # for first parent listing, has_main is False we skip check
                # for second parent listing, has_main is True,
                # is has_sub is False, child listing is missing
                if has_main and not has_sub:
                    raise ValueError(
                        f'Row {count}: Parent must have atleast 1 child')

                has_main = True
                has_sub = False
                has_gst_parent = False

                for column in self.parent_columns:
                    if column == 'gst' and row[column] == '':
                        has_gst_parent = False

                    if row[column]:
                        continue

                    raise ValueError(
                        f'Row {count}: {column} parent column cannot be empty')

            elif row['listing_type'] == 'SUB':
                has_sub = True

                if not has_main:
                    raise ValueError(f'Row {count}: Parent row is missing')

                for column in chain(self.child_columns,
                                    self.spec_columns,
                                    self.other_spec_columns,
                                    self.type_columns):
                    if column == 'brand':
                        continue

                    if column == 'gst' and not has_gst_parent and row[column] == '':
                        raise ValueError(
                            f'Row {count}: GST not set on parent or child')

                    if row[column]:
                        continue

                    raise ValueError(
                        f'Row {count}: {column} child column cannot be empty')

                if float(row['price']) > float(row['mrp']):
                    raise ValueError(f'Row {count}: Price greater than MRP')
            else:
                raise ValueError(
                    f'Row {count}: Empty row or invalid listing_type column')

            # row count for error tracking
            count += 1

        self.csv.seek(0)

        if (callable(self.added_validations)):
            # run any added validations on child classes
            self.added_validations()
            self.csv.seek(0)

    def get_types(self, row):
        '''Returns a list of Dictionaries containing product types
        [{'k': 'Size', 'v': 'XL'}]
        '''

        options = []
        title = ''

        for option in self.type_columns:
            options.append({'k': option, 'v': row[option]})
            title += row[option] + ', '

        # remove trailing ', '
        self.option_title = title.strip(', ')
        return options

    def get_specs(self, row):
        '''Returns a list of Dictionaries containing product specs
        [{'k': 'material', 'v': 'Nylon'}]
        '''

        # additional product specific specs are defined on child classes
        if type(self.added_specs) is tuple:
            self.spec_columns += self.added_specs

        specs = []

        for spec in self.spec_columns:
            if spec == 'brand':
                specs.append({'k': spec, 'v': self.brand})
                continue

            specs.append({'k': spec, 'v': row[spec]})

        return specs

    def get_other_specs(self, row):
        '''Returns a Dictionary containing mandatory product specs
        {'material': 'Nylon'}
        '''

        # additional prouduct specific specs are defined on child classes
        if type(self.other_added_specs) is tuple:
            self.other_spec_columns += self.other_added_specs

        specs = {}

        for spec in self.other_spec_columns:
            specs[spec] = row[spec]

        return specs

    def run(self):
        self.validate_file()

        # all well connect to Database
        self.db.connect()

        child_count = 1
        row_count = 2

        items = self.db.db.products.find(
            projection={'_id': 0, 'product_code': 1}
        )

        self.codes = [item['product_code'] for item in items]

        for row in self.reader:
            if row['listing_type'] == 'MAIN':
                child_count = 1

                product = self.compile_product(row)

                res = self.db.db.products.insert_one(product)

                if not res.acknowledged:
                    print(f'Product insert failed: Row {row_count}')

            if row['listing_type'] == 'SUB':
                code = product['product_code']

                item = self.compile_variant(row, code, child_count)

                # Add the variant description to variant_info collection
                info_result = self.db.db.variant_info.insert_one(
                    {'info': row['description']})

                if info_result.acknowledged:
                    # add the
                    item['info_id'] = ObjectId(info_result.inserted_id)
                else:
                    print('Info insert failed', item['title'])

                variant_result = self.db.db.product_variants.insert_one(item)

                if not variant_result.acknowledged:
                    print(f'Variant insert failed: Row {row_count}')

                child_count += 1

            row_count += 1

        print(self.file.name, 'Done')

    def compile_product(self, row):
        'Returns a Dictionary representing the product'

        self.brand = row['brand']
        self.title = f'{self.brand} {row["title"]}'
        self.href = row['href'].lower().replace(' ', '-')
        self.gst = int(row['gst']) if row['gst'] else None

        product_code = row['category_code'] + self.generate_code()

        while product_code in self.codes:
            product_code = row['category_code'] + self.generate_code()

        # href links to first child
        link = f'{product_code}001/{self.href}'
        img = row['image'].split(',')

        return {
            'title': self.title,
            'product_code': product_code,
            'href': link.lower().replace(' ', '-'),
            'image': [img[0].strip(), img[1].strip()],
        }

    def compile_variant(self, row, category_code, child_count):
        'Returns a dictionary describing the product variant'

        # get the variants and set the variant_title
        # child_count is 0 padded upto 3 chars - 001 002 etc
        sku = f'{category_code}{child_count:03d}'
        item_types = self.get_types(row)

        item = {
            'sku': sku,
            'href': f'{sku}/{self.href}',
            'title': f'{self.title}, {self.option_title}',
            'price': float(row['price']),
            'mrp': float(row['mrp']),
            'gst': int(self.gst) if self.gst else int(row['gst']),
            'qty': int(row['qty']),
            'type': item_types,
            'specs': self.get_specs(row),
            'other_specs': self.get_other_specs(row),
            'images': [],
            'z_index': 1 if child_count == 1 else 0.5
        }

        # description is the last column,
        # So with 5 images we start length - 6 and end length - 1
        for i in islice(row, self.length - 6, self.length - 1):
            img = row[i].split(',')
            item['images'].append([img[0].strip(), img[1].strip()])

        return item


class FoamRoller(BaseTemplate):
    type_columns = ('density',)


class Clothes(BaseTemplate):
    type_columns = ('color', 'size')


class ExerciseBands(BaseTemplate):
    type_columns = ('tension', )
