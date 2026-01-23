def validate_not_empty(value: str) -> bool:
    return bool(value and value.strip())


def validate_price(price) -> bool:
    try:
        return float(price) > 0
    except ValueError:
        return False
