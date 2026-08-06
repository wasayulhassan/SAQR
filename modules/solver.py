"""
solver.py
Math / stats / logic problem solving using sympy + scipy.
Supports: equation solving, symbolic simplification/derivatives/integrals,
and simple linear optimization.
"""

import sympy as sp
from scipy.optimize import linprog


def solve_equation(expr_str: str, var_str: str = "x") -> dict:
    """Solve an equation like 'x**2 - 4 = 0' or expression '2*x + 3'."""
    var = sp.symbols(var_str)
    try:
        if "=" in expr_str:
            lhs, rhs = expr_str.split("=", 1)
            equation = sp.Eq(sp.sympify(lhs), sp.sympify(rhs))
        else:
            equation = sp.Eq(sp.sympify(expr_str), 0)
        solutions = sp.solve(equation, var)
        return {"ok": True, "solutions": [str(s) for s in solutions]}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def simplify_expression(expr_str: str) -> dict:
    try:
        simplified = sp.simplify(sp.sympify(expr_str))
        return {"ok": True, "result": str(simplified)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def derivative(expr_str: str, var_str: str = "x") -> dict:
    var = sp.symbols(var_str)
    try:
        d = sp.diff(sp.sympify(expr_str), var)
        return {"ok": True, "result": str(d)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def integral(expr_str: str, var_str: str = "x") -> dict:
    var = sp.symbols(var_str)
    try:
        i = sp.integrate(sp.sympify(expr_str), var)
        return {"ok": True, "result": str(i)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def linear_optimize(c: list, A_ub: list = None, b_ub: list = None,
                     A_eq: list = None, b_eq: list = None,
                     bounds: list = None, maximize: bool = True) -> dict:
    """
    Minimize/maximize c^T x subject to A_ub x <= b_ub, A_eq x = b_eq, bounds.
    Example: maximize profit = 3x + 5y subject to constraints.
    """
    try:
        obj = [-v for v in c] if maximize else c
        res = linprog(obj, A_ub=A_ub, b_ub=b_ub, A_eq=A_eq, b_eq=b_eq,
                       bounds=bounds, method="highs")
        if not res.success:
            return {"ok": False, "error": res.message}
        value = -res.fun if maximize else res.fun
        return {"ok": True, "x": res.x.tolist(), "objective_value": round(float(value), 4)}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def solve(problem_type: str, **kwargs) -> dict:
    """Dispatch helper used by the Flask route."""
    dispatch = {
        "equation": solve_equation,
        "simplify": simplify_expression,
        "derivative": derivative,
        "integral": integral,
        "optimize": linear_optimize,
    }
    fn = dispatch.get(problem_type)
    if not fn:
        return {"ok": False, "error": f"Unknown problem_type '{problem_type}'"}
    return fn(**kwargs)
