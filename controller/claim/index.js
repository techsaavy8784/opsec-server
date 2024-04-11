import { CovalentClient } from "@covalenthq/client-sdk";

const restrict_check = async (address) => {
    const client = new CovalentClient(process.env.COVALENT_API_KEY);
    const resp = await client.BalanceService.getHistoricalPortfolioForWalletAddress("eth-mainnet",address, {"days": 10});
    const datas = resp.data.items[0].holdings;
    for (let i = 1; i < datas.length; i++) {
        if (datas[i].open.balance < datas[i - 1].open.balance) {
          return false;
        }
    }
    return true
}
export default {
    restrict_check
};

