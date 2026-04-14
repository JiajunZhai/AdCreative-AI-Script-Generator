from usage_tokens import total_tokens_from_completion


class _Usage:
    def __init__(self, total=None, pt=None, ct=None):
        self.total_tokens = total
        self.prompt_tokens = pt
        self.completion_tokens = ct


class _Resp:
    def __init__(self, usage):
        self.usage = usage


def test_total_tokens_prefers_total_field():
    assert total_tokens_from_completion(_Resp(_Usage(total=500))) == 500


def test_total_tokens_sums_prompt_completion():
    assert total_tokens_from_completion(_Resp(_Usage(pt=100, ct=40))) == 140


def test_total_tokens_none_when_no_usage():
    class R:
        usage = None

    assert total_tokens_from_completion(R()) is None
