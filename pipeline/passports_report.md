# 여권 표지 이미지 보고서

- 작성일: 2026-09-24
- 마지막 수집(collect): 2026-09-24, 네트워크 차단으로 중단
- 마지막 적용(apply): 실행 기록 없음
- 스크립트: `pipeline/fetch_passports.py`, 검수 기록: `pipeline/passports_review.json`

## 수집하지 못함: 네트워크 차단

이번 collect는 Wikimedia 서버에 접속하지 못해 첫 요청(식별자 확인)에서 멈췄습니다. 후보를 하나도 모으지 못했고, 이미지를 내려받지 않았습니다. `data/appdata.json`과 `assets/passports/`는 건드리지 않았습니다.

접속하지 못한 호스트:

- `www.wikidata.org`: proxy refused CONNECT (403 Forbidden)
- `query.wikidata.org`: proxy refused CONNECT (403 Forbidden)
- `commons.wikimedia.org`: proxy refused CONNECT (403 Forbidden)
- `upload.wikimedia.org`: proxy refused CONNECT (403 Forbidden)

이 스크립트는 Wikidata와 Wikimedia Commons만 출처로 쓰며, 미러나 다른 사이트로 우회하지 않습니다. 아래 네 호스트에 HTTPS로 접속할 수 있는 환경에서 "실행 방법"대로 다시 돌리면 됩니다: `www.wikidata.org`, `query.wikidata.org`, `commons.wikimedia.org`, `upload.wikimedia.org`.

## 집계

| 구분 | 곳 |
|---|---:|
| 채택 (자체 이미지) | 0 |
| 채택 (주권국 이미지로 대체) | 0 |
| 없음 | 236 |
| 합계 | 236 |

`data/appdata.json`에 PASSPORT가 아직 없거나 비어 있습니다.

## 이미지가 없는 곳 (236)

| M49 | 이름 | English |
|---:|---|---|
| 108 | 부룬디 | Burundi |
| 174 | 코모로 | Comoros |
| 262 | 지부티 | Djibouti |
| 232 | 에리트레아 | Eritrea |
| 231 | 에티오피아 | Ethiopia |
| 404 | 케냐 | Kenya |
| 450 | 마다가스카르 | Madagascar |
| 454 | 말라위 | Malawi |
| 480 | 모리셔스 | Mauritius |
| 175 | 마요트 | Mayotte |
| 508 | 모잠비크 | Mozambique |
| 638 | 레위니옹 | Réunion |
| 646 | 르완다 | Rwanda |
| 690 | 세이셸 | Seychelles |
| 706 | 소말리아 | Somalia |
| 728 | 남수단 | South Sudan |
| 800 | 우간다 | Uganda |
| 834 | 탄자니아 | Tanzania |
| 894 | 잠비아 | Zambia |
| 716 | 짐바브웨 | Zimbabwe |
| 24 | 앙골라 | Angola |
| 120 | 카메룬 | Cameroon |
| 140 | 중앙아프리카공화국 | Central African Republic |
| 148 | 차드 | Chad |
| 178 | 콩고공화국 | Congo |
| 180 | 콩고민주공화국 | DR Congo |
| 226 | 적도기니 | Equatorial Guinea |
| 266 | 가봉 | Gabon |
| 678 | 상투메 프린시페 | Sao Tome and Principe |
| 12 | 알제리 | Algeria |
| 818 | 이집트 | Egypt |
| 434 | 리비아 | Libya |
| 504 | 모로코 | Morocco |
| 729 | 수단 | Sudan |
| 788 | 튀니지 | Tunisia |
| 732 | 서사하라 | Western Sahara |
| 72 | 보츠와나 | Botswana |
| 748 | 에스와티니 | Eswatini |
| 426 | 레소토 | Lesotho |
| 516 | 나미비아 | Namibia |
| 710 | 남아프리카공화국 | South Africa |
| 204 | 베냉 | Benin |
| 854 | 부르키나파소 | Burkina Faso |
| 132 | 카보베르데 | Cabo Verde |
| 384 | 코트디부아르 | Côte d'Ivoire |
| 270 | 감비아 | Gambia |
| 288 | 가나 | Ghana |
| 324 | 기니 | Guinea |
| 624 | 기니비사우 | Guinea-Bissau |
| 430 | 라이베리아 | Liberia |
| 466 | 말리 | Mali |
| 478 | 모리타니 | Mauritania |
| 562 | 니제르 | Niger |
| 566 | 나이지리아 | Nigeria |
| 654 | 세인트헬레나 | Saint Helena |
| 686 | 세네갈 | Senegal |
| 694 | 시에라리온 | Sierra Leone |
| 768 | 토고 | Togo |
| 398 | 카자흐스탄 | Kazakhstan |
| 417 | 키르기스스탄 | Kyrgyzstan |
| 762 | 타지키스탄 | Tajikistan |
| 795 | 투르크메니스탄 | Turkmenistan |
| 860 | 우즈베키스탄 | Uzbekistan |
| 156 | 중국 | China |
| 344 | 홍콩 | Hong Kong |
| 446 | 마카오 | Macao |
| 158 | 대만 | Taiwan |
| 408 | 북한 | North Korea |
| 392 | 일본 | Japan |
| 496 | 몽골 | Mongolia |
| 410 | 대한민국 | South Korea |
| 4 | 아프가니스탄 | Afghanistan |
| 50 | 방글라데시 | Bangladesh |
| 64 | 부탄 | Bhutan |
| 356 | 인도 | India |
| 364 | 이란 | Iran |
| 462 | 몰디브 | Maldives |
| 524 | 네팔 | Nepal |
| 586 | 파키스탄 | Pakistan |
| 144 | 스리랑카 | Sri Lanka |
| 96 | 브루나이 | Brunei |
| 116 | 캄보디아 | Cambodia |
| 360 | 인도네시아 | Indonesia |
| 418 | 라오스 | Laos |
| 458 | 말레이시아 | Malaysia |
| 104 | 미얀마 | Myanmar |
| 608 | 필리핀 | Philippines |
| 702 | 싱가포르 | Singapore |
| 764 | 태국 | Thailand |
| 626 | 동티모르 | Timor-Leste |
| 704 | 베트남 | Viet Nam |
| 51 | 아르메니아 | Armenia |
| 31 | 아제르바이잔 | Azerbaijan |
| 48 | 바레인 | Bahrain |
| 196 | 키프로스 | Cyprus |
| 268 | 조지아 | Georgia |
| 368 | 이라크 | Iraq |
| 376 | 이스라엘 | Israel |
| 400 | 요르단 | Jordan |
| 414 | 쿠웨이트 | Kuwait |
| 422 | 레바논 | Lebanon |
| 512 | 오만 | Oman |
| 634 | 카타르 | Qatar |
| 682 | 사우디아라비아 | Saudi Arabia |
| 275 | 팔레스타인 | Palestine |
| 760 | 시리아 | Syria |
| 792 | 튀르키예 | Türkiye |
| 784 | 아랍에미리트 | United Arab Emirates |
| 887 | 예멘 | Yemen |
| 112 | 벨라루스 | Belarus |
| 100 | 불가리아 | Bulgaria |
| 203 | 체코 | Czechia |
| 348 | 헝가리 | Hungary |
| 616 | 폴란드 | Poland |
| 498 | 몰도바 | Moldova |
| 642 | 루마니아 | Romania |
| 643 | 러시아 | Russia |
| 703 | 슬로바키아 | Slovakia |
| 804 | 우크라이나 | Ukraine |
| 208 | 덴마크 | Denmark |
| 233 | 에스토니아 | Estonia |
| 234 | 페로 제도 | Faroe Islands |
| 246 | 핀란드 | Finland |
| 831 | 건지 | Guernsey |
| 352 | 아이슬란드 | Iceland |
| 372 | 아일랜드 | Ireland |
| 833 | 맨섬 | Isle of Man |
| 832 | 저지 | Jersey |
| 428 | 라트비아 | Latvia |
| 440 | 리투아니아 | Lithuania |
| 578 | 노르웨이 | Norway |
| 752 | 스웨덴 | Sweden |
| 826 | 영국 | United Kingdom |
| 8 | 알바니아 | Albania |
| 20 | 안도라 | Andorra |
| 70 | 보스니아 헤르체고비나 | Bosnia and Herzegovina |
| 191 | 크로아티아 | Croatia |
| 292 | 지브롤터 | Gibraltar |
| 300 | 그리스 | Greece |
| 380 | 이탈리아 | Italy |
| 412 | 코소보 | Kosovo |
| 470 | 몰타 | Malta |
| 499 | 몬테네그로 | Montenegro |
| 807 | 북마케도니아 | North Macedonia |
| 620 | 포르투갈 | Portugal |
| 674 | 산마리노 | San Marino |
| 688 | 세르비아 | Serbia |
| 705 | 슬로베니아 | Slovenia |
| 724 | 스페인 | Spain |
| 40 | 오스트리아 | Austria |
| 56 | 벨기에 | Belgium |
| 250 | 프랑스 | France |
| 276 | 독일 | Germany |
| 438 | 리히텐슈타인 | Liechtenstein |
| 442 | 룩셈부르크 | Luxembourg |
| 492 | 모나코 | Monaco |
| 528 | 네덜란드 | Netherlands |
| 756 | 스위스 | Switzerland |
| 660 | 앵귈라 | Anguilla |
| 28 | 앤티가 바부다 | Antigua and Barbuda |
| 533 | 아루바 | Aruba |
| 44 | 바하마 | Bahamas |
| 52 | 바베이도스 | Barbados |
| 535 | 카리브 네덜란드 | Bonaire, Sint Eustatius and Saba |
| 92 | 영국령 버진아일랜드 | British Virgin Islands |
| 136 | 케이맨 제도 | Cayman Islands |
| 192 | 쿠바 | Cuba |
| 531 | 퀴라소 | Curaçao |
| 212 | 도미니카 | Dominica |
| 214 | 도미니카공화국 | Dominican Republic |
| 308 | 그레나다 | Grenada |
| 312 | 과들루프 | Guadeloupe |
| 332 | 아이티 | Haiti |
| 388 | 자메이카 | Jamaica |
| 474 | 마르티니크 | Martinique |
| 500 | 몬트세랫 | Montserrat |
| 630 | 푸에르토리코 | Puerto Rico |
| 652 | 생바르텔레미 | Saint Barthélemy |
| 659 | 세인트키츠 네비스 | Saint Kitts and Nevis |
| 662 | 세인트루시아 | Saint Lucia |
| 663 | 생마르탱 | Saint Martin (French part) |
| 670 | 세인트빈센트 그레나딘 | Saint Vincent and the Grenadines |
| 534 | 신트마르턴 | Sint Maarten (Dutch part) |
| 780 | 트리니다드 토바고 | Trinidad and Tobago |
| 796 | 터크스 케이커스 제도 | Turks and Caicos Islands |
| 850 | 미국령 버진아일랜드 | United States Virgin Islands |
| 84 | 벨리즈 | Belize |
| 188 | 코스타리카 | Costa Rica |
| 222 | 엘살바도르 | El Salvador |
| 320 | 과테말라 | Guatemala |
| 340 | 온두라스 | Honduras |
| 484 | 멕시코 | Mexico |
| 558 | 니카라과 | Nicaragua |
| 591 | 파나마 | Panama |
| 32 | 아르헨티나 | Argentina |
| 68 | 볼리비아 | Bolivia |
| 76 | 브라질 | Brazil |
| 152 | 칠레 | Chile |
| 170 | 콜롬비아 | Colombia |
| 218 | 에콰도르 | Ecuador |
| 238 | 포클랜드 제도 | Falkland Islands |
| 254 | 프랑스령 기아나 | French Guiana |
| 328 | 가이아나 | Guyana |
| 600 | 파라과이 | Paraguay |
| 604 | 페루 | Peru |
| 740 | 수리남 | Suriname |
| 858 | 우루과이 | Uruguay |
| 862 | 베네수엘라 | Venezuela |
| 60 | 버뮤다 | Bermuda |
| 124 | 캐나다 | Canada |
| 304 | 그린란드 | Greenland |
| 666 | 생피에르 미클롱 | Saint Pierre and Miquelon |
| 840 | 미국 | United States |
| 36 | 호주 | Australia |
| 554 | 뉴질랜드 | New Zealand |
| 242 | 피지 | Fiji |
| 540 | 뉴칼레도니아 | New Caledonia |
| 598 | 파푸아뉴기니 | Papua New Guinea |
| 90 | 솔로몬제도 | Solomon Islands |
| 548 | 바누아투 | Vanuatu |
| 316 | 괌 | Guam |
| 296 | 키리바시 | Kiribati |
| 584 | 마셜제도 | Marshall Islands |
| 583 | 미크로네시아 연방 | Micronesia |
| 520 | 나우루 | Nauru |
| 580 | 북마리아나 제도 | Northern Mariana Islands |
| 585 | 팔라우 | Palau |
| 16 | 아메리칸사모아 | American Samoa |
| 184 | 쿡 제도 | Cook Islands |
| 258 | 프랑스령 폴리네시아 | French Polynesia |
| 570 | 니우에 | Niue |
| 882 | 사모아 | Samoa |
| 772 | 토켈라우 | Tokelau |
| 776 | 통가 | Tonga |
| 798 | 투발루 | Tuvalu |
| 876 | 왈리스 퓌튀나 | Wallis and Futuna |

## 제외 사유

collect가 끝까지 돌지 않아 후보 단계의 사유(라이선스, 후보 없음)는 집계할 수 없습니다.

- 라이선스 불통과: 0건
- 사람 검수 거부: 0건
- 후보 없음: 알 수 없음 (수집 못 함)
- 검수 대기 (라이선스는 통과했지만 아직 판정이 없는 후보가 있는 곳): 0곳
- Wikidata에서 일반 여권이 아니라서 뺀 항목 (외교관·관용·공무 여권 등): 0개
- 기타 후보 오류 (파일 없음, 내려받기 실패): 0건
- 네트워크·서버 실패: 1건
  - collect 전체 중단: `www.wikidata.org`, `query.wikidata.org`, `commons.wikimedia.org`, `upload.wikimedia.org`

## 라이선스 규칙

- 통과: 퍼블릭 도메인(Public domain), CC0, CC BY 2.0 이상, CC BY-SA 2.0 이상. 나라별 포팅판(예: CC BY-SA 3.0 de)과 IGO판도 버전 숫자로 판단합니다.
- 불통과: 그 밖의 모든 라이선스, GFDL 단독, 공정 이용, 라이선스 표기 없음, CC BY 1.0 같은 2.0 미만 버전.
- 판단 근거는 Commons API `extmetadata`의 `LicenseShortName`입니다.
- 휘장(insignia) 같은 저작권 밖 제한은 불통과 사유가 아닙니다. `Restrictions` 값을 PASSPORT의 `restrictions`에 그대로 적습니다.
- 출처는 Wikidata와 Wikimedia Commons뿐입니다. 상업 사이트, 검색 엔진 이미지, PRADO 같은 진위 확인 DB, 라이선스 표기가 없는 자료는 쓰지 않습니다.

## 가공

- 높이 720px 이하로 줄이고 WebP(품질 80, 60KB를 넘게 크면 55까지 낮춤)로 바꿉니다. EXIF를 비롯한 메타데이터는 모두 지웁니다.
- 자르기는 검수 기록의 `crop`에 적힌 배경만 잘라 냅니다. 표지 그림은 고치지 않습니다.
- `changes`에는 "크기 조정" 또는 "잘라 냄, 크기 조정"을 적습니다.

## 실행 방법

1. `pip install requests Pillow` (Python 3.11 이상)
2. `python3 pipeline/fetch_passports.py collect`: 식별자 확인, 후보 찾기, 라이선스 확인, 후보 내려받기. 결과는 `pipeline/.cache/review.html`입니다.
3. `pipeline/.cache/review.html`을 브라우저로 열어 후보를 사람이 하나씩 보고, 판정을 `pipeline/passports_review.json`에 적습니다. 사람이 승인하지 않은 후보는 절대 쓰지 않습니다.
4. `python3 pipeline/fetch_passports.py apply`: 승인한 것만 처리해 `assets/passports/<M49>.webp`와 `data/appdata.json`의 PASSPORT에 반영합니다.
5. 거부한 곳이 있으면 collect를 다시 돌리면 다음 후보를 가져옵니다. 끝나면 `python3 build.py`.
