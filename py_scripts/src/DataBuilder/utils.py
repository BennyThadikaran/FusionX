from faker import Faker
from datetime import datetime, timedelta
from string import ascii_lowercase, digits
from random import choices


fake = Faker("en_IN")


def generateAlphaNumCode(count=6):
    '''Generates a 6 digit unique product code'''

    alpha_num = ascii_lowercase + digits

    return ''.join(choices(alpha_num, k=count))


def getName(part="full"):
    if part == "full":
        return fake.name()

    if part == "first":
        return fake.first_name()

    return fake.last_name()


def getParagraph(sentenceCount=10):
    return fake.paragraph(nb_sentences=sentenceCount, variable_nb_sentences=False)


def getSentences(wordCount=6, sentenceCount=1, out=None):
    sentence = fake.sentence(
        nb_words=wordCount, variable_nb_words=True)

    if out is None and sentenceCount == 1:
        return sentence

    sentenceCount -= 1

    if out is None:
        return getSentences(wordCount, sentenceCount, [sentence])

    out.append(sentence)

    if sentenceCount == 0:
        return " ".join(out)

    return getSentences(wordCount, sentenceCount, out)


def getDate(daysBetween=180):
    end = datetime.now()
    start = end - timedelta(daysBetween)

    return fake.date_time_between_dates(datetime_start=start, datetime_end=end)
