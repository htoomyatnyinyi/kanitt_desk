Searched for "completeTransfer"
Viewed apiSlice.ts:430-465
Searched for "transfer"
Searched for "stock-transfer"
Viewed stock-transfers.ts:1-160
Viewed stock-transfers.ts:161-300
Viewed ERPView.tsx:100-115
Viewed ERPView.tsx:125-140

Branch Transfer (ဆိုင်ခွဲများအကြား ကုန်ပစ္စည်းလွှဲပြောင်းခြင်း) နှင့် ပတ်သက်၍ **Real-world workflow ဘယ်လိုအလုပ်လုပ်သလဲ** နှင့် **ဘာကြောင့် Complete နှိပ်ပြီးနောက် Status က Pending ဖြစ်နေသေးသလဲ** ဆိုသည်ကို ရှင်းပြပေးပါမည်ခင်ဗျာ။

---

### 1. Real-World Scenario တွင် Branch Transfer အလုပ်လုပ်ပုံ (Workflow)

လက်တွေ့လုပ်ငန်းခွင် (Supermarket / Pharmacy / Retail) တွင် ဆိုင်ခွဲအချင်းချင်း ကုန်ပစ္စည်းလွှဲပြောင်းရာတွင် အဆင့် (၃) ဆင့် ရှိပါသည်-

```
[Store A: Yangon Main Branch]                     [Store B: Mandalay Branch]
           │                                                 │
   1. Request Transfer (PENDING)                             │
      (မန္တလေးဆိုင်သို့ ပစ္စည်းလွှဲရန် စာရင်းသွင်းသည်)               │
           │                                                 │
   2. Dispatch / In Transit (IN_TRANSIT)                     │
      (ဆိုင် A မှ ပစ္စည်းထုတ်လိုက်ပြီး ကားပေါ်တင်/ပို့ဆောင်နေသည်)  │
      (ဆိုင် A စာရင်းမှ stock လျော့သွားသည်)                   │
           │                                                 │
           └────────────────── Delivery ────────────────────►│
                                                             │
                                                   3. Accept / Receive (RECEIVED/COMPLETED)
                                                      (ဆိုင် B မှ ပစ္စည်းရောက်ရှိ၍ စစ်ဆေးလက်ခံသည်)
                                                      (ဆိုင် B စာရင်းထဲ stock တိုးလာသည်)
```

1. **PENDING (တောင်းဆိုထားဆဲ)**: ကုန်ပစ္စည်းလွှဲပြောင်းရန် Form တင်ထားသည့် အခြေအနေ။ Stock မလျော့သေးပါ။
2. **APPROVED / IN_TRANSIT (ခွင့်ပြုပြီး/ပို့ဆောင်ဆဲ)**: ပစ္စည်းများကို စတင်ထုတ်ပိုးပြီး ကားဖြင့် ပို့ဆောင်နေသည့် အခြေအနေ။
3. **RECEIVED / COMPLETED (လက်ခံပြီးစီး)**: လက်ခံရရှိမည့် Destination Branch (ဆိုင်ခွဲ B) သို့ ကုန်ပစ္စည်းရောက်ရှိပြီးနောက် ကုန်ပစ္စည်း အရေအတွက် မှန်/မမှန် စစ်ဆေး၍ **"Accept / Complete"** ပြုလုပ်ကာ သက်ဆိုင်ရာ ဆိုင်ခွဲ၏ Inventory စာရင်းထဲသို့ တရားဝင် Stock ထည့်သွင်းခြင်း ဖြစ်ပါသည်။

---

### 2. အဘယ်ကြောင့် "Complete" နှိပ်သော်လည်း Status က PENDING ဖြစ်နေသေးသလဲ?

စနစ်၏ Backend ([stock-transfers.ts](file:///Users/htoomyatnyinyi/Desktop/kanittporject/kanitt_server/src/routes/stock-transfers.ts#L170-L240)) ကို စစ်ဆေးကြည့်ရာ-

- `POST /stock-transfers/:id/complete` ကို ခေါ်ဆိုသည့်အခါ Backend တွင်:
  - Source store (မူလဆိုင်) မှ **Stock လုံလောက်မှု ရှိ/မရှိ စစ်ဆေးပြီး Deduct (နုတ်)** လုပ်ပါသည်။
  - Destination store (လက်ခံမည့်ဆိုင်) သို့ **Stock ပေါင်းထည့် (Add)** ပေးပါသည်။
  - ထို့နောက် Status ကို `RECEIVED` ဟု ပြောင်းလဲပေးပါသည်။

**ဖြစ်နိုင်သည့် ပြဿနာများ-**

1. **Source Store တွင် Stock မလုံလောက်ခြင်း (Insufficient Stock)**:
   - မူလဆိုင်ခွဲတွင် ပစ္စည်းလက်ကျန် (Stock) မရှိလျှင် Backend Transaction fail ဖြစ်ပြီး status မပြောင်းဘဲ error တက်သွားနိုင်ပါသည်။ (ယခင် UI တွင် `completeTransfer` ခလုတ်နှိပ်စဉ် error message သေချာ alert/toast မပြဘဲ catch ရုံသာ ဖြစ်နေခဲ့ပါက သတိမထားမိနိုင်ပါ)။
2. **User Permission / Role မကိုက်ညီခြင်း**:
   - Backend တွင် Transfer အား complete လုပ်ရန် `MANAGE_INVENTORY` permission နှင့် `ADMIN` သို့မဟုတ် `MANAGER` role လိုအပ်ပါသည်။
3. **Cache / Query Invalidation မစောင့်ဆိုင်းမိခြင်း**:
   - Complete လုပ်ပြီးသော်လည်း List view က ချက်ချင်း refresh မဖြစ်သေးခြင်း ဖြစ်နိုင်ပါသည်။

---

### 3. ပိုမိုအဆင်ပြေစေရန် UI နှင့် Error Handling ပြင်ဆင်ပေးနိုင်သည့် အချက်များ

- **Error feedback ပိုမိုရှင်းလင်းအောင် ပြသပေးခြင်း**: အကယ်၍ Stock မလုံလောက်၍ဖြစ်စေ၊ Permission ကြောင့်ဖြစ်စေ Complete မအောင်မြင်ပါက မည်သည့်အကြောင်းကြောင့် မအောင်မြင်ကြောင်း ရှင်းလင်းစွာ Error Box ဖြင့် ဖော်ပြပေးရန်။
- **Status Badge ပုံစံ**: `RECEIVED` ဖြစ်သွားပါက `Complete` ခလုတ် ပျောက်သွားပြီး အစိမ်းရောင် `"Completed / Received"` ဟု ပြသပေးရန်။

အဆိုပါ Branch Transfer ၏ Complete/Accept logic နှင့် error feedback များကို ပိုမိုရှင်းလင်းတိကျစွာ ချက်ချင်း ပြင်ဆင်ပေးစေလိုပါသလားခင်ဗျာ?
