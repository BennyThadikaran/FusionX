from csv import DictReader
from itertools import islice, chain
from bson.objectid import ObjectId
from string import ascii_lowercase, digits
from random import choices
from pathlib import Path
from Model import Model


class BaseTemplate:
    '''
    A base class for all product templates

    Child classes must implement:
    type_columns: Tuple(str, ...) - Required Attribute
        columns names for product variant options like size, color etc

    added_specs: Tuple(str, ...) - Optional Attribute
        Any additional column names to add to spec_columns

    added_other_specs: Tuple(str, ...) - Optional Attribute
        Any additional column names to add to other_specs_columns

    added_validations: callable - Optional method
        Any additional validations to be run on the file

    To generate a template file:
    Instantiate the Class and call the generate_file method
    '''

    parent_columns = ('listing_type', 'brand', 'title',
                      'category_code', 'href', 'gst')

    child_columns = ('price', 'mrp', 'qty', 'image1', 'image2', 'image3',
                     'image4', 'image5', 'description')

    # Attributes used for filtering products
    spec_columns = ('origin', 'material', 'basecolor')

    # attributes that will not be used in filters
    other_spec_columns = ('weight', 'dimensions')

    alpha_num = ascii_lowercase + digits

    type_columns = tuple()
    added_validations = None
    added_specs = None
    added_other_specs = None

    def __init__(self, file: Path, model: Model):
        self.file_exists = file.is_file()

        self.file = file
        self.model = model

    def __enter__(self):
        if not self.file_exists:
            return self

        self.csv = self.file.open()
        self.reader = DictReader(self.csv, dialect='excel-tab')

        if self.reader.fieldnames:
            self.length = len(self.reader.fieldnames)

        self.title = ''
        self.brand = ''

        self.db = self.model.connect()
        self.category_codes = self.model.getProductCategoryCodes()
        return self

    def __exit__(self, exc_type, exc_value, exc_trace):
        if self.file_exists:
            self.csv.close()
            self.model.con.close()

        if exc_type:
            exit(f'{exc_type}: {self.file.name}: {exc_value}: {exc_trace}')
        return True

    def _generate_code(self):
        '''Generates a 6 digit unique product code'''
        return ''.join(choices(self.alpha_num, k=6))

    def _validate_file(self):
        '''Checks if:
        File contains all columns as expected
        No blank row or empty values in parent and child columns
        Has atleast 1 parent row
        Every parent has atleast 1 child row
        On child rows, price <= MRP
        Run the added_validations method defined on the child class
        '''

        if not self.file_exists:
            raise FileNotFoundError(f'{self.file} does not exist')

        if self.type_columns is None:
            raise NotImplementedError(
                f'{self.__class__.__name__} must have a type_columns attribute')

        columns = self.reader.fieldnames

        if not columns:
            raise ValueError("Not a valid template file.")

        for column in chain(self.parent_columns,
                            self.child_columns,
                            self.type_columns,
                            self.other_spec_columns):
            if not column in columns:
                raise KeyError(f'{column} column missing from {self.file}')

        # Must have atleast 1 parent listing with listing_type=MAIN
        has_main = False

        # Must have atleast 1 child listing with listing_type=SUB
        has_sub = False

        # suppress pyright unbound warning
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

                    if (column == 'category_code' and
                            not row['category_code'] in self.category_codes):
                        raise ValueError(
                            f"Row {count}: {row['category_code']} not found in product_categories collection.")

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

                    # GST must be specified in either parent or all child rows
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

    def _get_types(self, row: dict):
        '''Returns a list of Dictionaries containing product types
        [{'k': 'Size', 'v': 'XL'}]
        '''

        options = []
        title = ''

        if isinstance(self.type_columns, tuple):
            for option in self.type_columns:
                options.append({'k': option, 'v': row[option]})
                title += row[option] + ', '

        # remove trailing ', '
        self.option_title = title.strip(', ')
        return options

    def _get_specs(self, row: dict):
        '''Returns a list of Dictionaries containing product specs
        [{'k': 'material', 'v': 'Nylon'}]
        '''

        # additional product specific specs are defined on child classes
        if type(self.added_specs) is tuple:
            self.spec_columns += self.added_specs

        specs = [{'k': 'brand', 'v': self.brand}]

        for spec in self.spec_columns:
            specs.append({'k': spec, 'v': row[spec]})

        return specs

    def _get_other_specs(self, row: dict):
        '''Returns a Dictionary containing mandatory product specs
        {'material': 'Nylon'}
        '''

        # additional prouduct specific specs are defined on child classes
        if type(self.added_other_specs) is tuple:
            self.other_spec_columns += self.added_other_specs

        specs = {}

        for spec in self.other_spec_columns:
            specs[spec] = row[spec]

        return specs

    def generate_file(self):
        """Generates a template file with the filename supplied in the contructor"""

        if not self.type_columns:
            raise NotImplementedError(
                f'{self.__class__.__name__} must have a type_columns attribute')

        columns = self.parent_columns + self.type_columns + self.spec_columns

        if self.added_specs:
            columns += self.added_specs

        columns += self.other_spec_columns

        if self.added_other_specs:
            columns += self.added_other_specs

        columns += self.child_columns

        with self.file.open("w") as f:
            f.write('\t'.join(columns) + '\nMAIN\nSUB\n')

    def run(self):
        '''Run validations on the file and if error free,
        add products to the database
        '''

        self._validate_file()

        child_count = 1
        row_count = 2

        items = self.db.products.find(
            projection={'_id': 0, 'product_code': 1}
        )

        self.codes = [item['product_code'] for item in items]
        product = None

        for row in self.reader:
            if row['listing_type'] == 'MAIN':
                child_count = 1

                product = self._compile_product(row)

                res = self.db.products.insert_one(product)

                if not res.acknowledged:
                    print(f'Product insert failed: Row {row_count}')

            if row['listing_type'] == 'SUB':
                if product is None:
                    raise Exception()

                code = product['product_code']

                item = self._compile_variant(row, code, child_count)

                # Add the variant description to variant_info collection
                info_result = self.db.variant_info.insert_one(
                    {'info': row['description']})

                if info_result.acknowledged:
                    # add the
                    item['info_id'] = ObjectId(info_result.inserted_id)
                else:
                    print('Info insert failed', item['title'])

                variant_result = self.db.product_variants.insert_one(item)

                if not variant_result.acknowledged:
                    print(f'Variant insert failed: Row {row_count}')

                child_count += 1

            row_count += 1

        print(self.file.name, 'Done')

    def _compile_product(self, row: dict):
        'Returns a Dictionary representing the product'

        self.brand = row['brand']
        self.title = f'{self.brand} {row["title"]}'
        self.href = row['href'].lower().replace(' ', '-')
        self.gst = int(row['gst']) if row['gst'] else None

        product_code = row['category_code'] + self._generate_code()

        while product_code in self.codes:
            product_code = row['category_code'] + self._generate_code()

        # href links to first child
        link = f'{product_code}001/{self.href}'

        return {
            'title': self.title,
            'product_code': product_code,
            'href': link.lower().replace(' ', '-'),
        }

    def _compile_variant(self, row: dict, category_code: str, child_count: int):
        'Returns a dictionary describing the product variant'

        # get the variants and set the variant_title
        # child_count is 0 padded upto 3 chars - 001 002 etc
        sku = f'{category_code}{child_count:03d}'
        item_types = self._get_types(row)

        item = {
            'sku': sku,
            'href': f'{sku}/{self.href}',
            'title': f'{self.title}, {self.option_title}',
            'price': float(row['price']),
            'mrp': float(row['mrp']),
            'gst': int(self.gst) if self.gst else int(row['gst']),
            'qty': int(row['qty']),
            'type': item_types,
            'specs': self._get_specs(row),
            'other_specs': self._get_other_specs(row),
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
