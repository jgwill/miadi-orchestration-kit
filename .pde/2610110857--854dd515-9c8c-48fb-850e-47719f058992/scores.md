needs you     A1   do_after_go     p=0.43 ~1076 tokens
after your go A2   do_now          p=0.67 ~1062 tokens
after your go A3   do_now          p=0.27 ~1055 tokens
after your go A4   do_after_go     p=0.14 ~1090 tokens
after your go A5   do_now          p=0.25 ~1066 tokens
needs you     A6   needs_decision  p=0.23 ~1068 tokens
after your go A7   do_now          p=0.58 ~1073 tokens
needs you     D1   do_after_go     p=0.07 ~934 tokens
needs you     D2   needs_decision  p=0.53 ~913 tokens
needs you     D3   needs_decision  p=0.27 ~940 tokens
after your go D4   do_now          p=0.40 ~906 tokens
needs you     Q1   needs_decision  p=0.22 ~911 tokens
needs you     Q2   needs_decision  p=0.56 ~911 tokens
needs you     Q3   needs_decision  p=0.09 ~907 tokens
needs you     Q4   needs_decision  p=0.34 ~902 tokens
ledger /home/mia/.miadi/decisions/proposal-score.jsonl

| code | band | obvious_now | p | why |
|---|---|---|---|---|
| A1 | needs you | do_after_go | 0.43 | needs_owner 0.55: the Decision Gate's D1 rule, never settled by the number |
| A2 | after your go | do_now | 0.67 | obvious_now do_now 0.67 below act_at 0.8 |
| A3 | after your go | do_now | 0.27 | obvious_now do_now 0.27 below act_at 0.8 |
| A4 | after your go | do_after_go | 0.14 | obvious_now do_after_go 0.14 |
| A5 | after your go | do_now | 0.25 | obvious_now do_now 0.25 below act_at 0.8 |
| A6 | needs you | needs_decision | 0.23 | needs_owner 0.88: the Decision Gate's D1 rule, never settled by the number |
| A7 | after your go | do_now | 0.58 | obvious_now do_now 0.58 below act_at 0.8 |
| D1 | needs you | do_after_go | 0.07 | needs_owner 0.52: the Decision Gate's D1 rule, never settled by the number |
| D2 | needs you | needs_decision | 0.53 | needs_owner 0.87: the Decision Gate's D1 rule, never settled by the number |
| D3 | needs you | needs_decision | 0.27 | needs_owner 0.73: the Decision Gate's D1 rule, never settled by the number |
| D4 | after your go | do_now | 0.40 | obvious_now do_now 0.40 below act_at 0.8 |
| Q1 | needs you | needs_decision | 0.22 | obvious_now needs_decision 0.22 |
| Q2 | needs you | needs_decision | 0.56 | obvious_now needs_decision 0.56 |
| Q3 | needs you | needs_decision | 0.09 | obvious_now needs_decision 0.09 |
| Q4 | needs you | needs_decision | 0.34 | obvious_now needs_decision 0.34 |

would do now: none
after your go: A2, A3, A4, A5, A7, D4
needs you: A1, A6, D1, D2, D3, Q1, Q2, Q3, Q4
