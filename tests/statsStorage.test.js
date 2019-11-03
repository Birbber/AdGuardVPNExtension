import StatsStorage from '../src/background/connectivity/statsStorage/StatsStorage';

const storageApi = (() => {
    const storage = {};
    return {
        set: jest.fn((key, data) => {
            storage[key] = data;
            return Promise.resolve();
        }),
        get: jest.fn((key) => {
            return Promise.resolve(storage[key]);
        }),
    };
})();

const statsStorage = new StatsStorage(storageApi);

describe('stats storage', () => {
    it('saves to storage and retrieves from storage', async () => {
        const expDownloaded = 100;
        const expUploaded = 50;
        await statsStorage.saveStats('example.org', { downloaded: expDownloaded, uploaded: expUploaded });
        expect(storageApi.set.calledOnce);
        const { downloaded, uploaded } = await statsStorage.getStats('example.org');
        expect(storageApi.get.calledOnce);
        expect(downloaded).toEqual(expDownloaded);
        expect(uploaded).toEqual(expUploaded);
    });

    it('correctly updates when incoming stats are lower', async () => {
        const downloaded1 = 100;
        const uploaded1 = 500;
        await statsStorage.saveStats('example.org', { downloaded: downloaded1, uploaded: uploaded1 });
        let stats = await statsStorage.getStats('example.org');
        expect(stats.downloaded).toEqual(downloaded1);
        expect(stats.uploaded).toEqual(uploaded1);

        const downloaded2 = 150;
        const uploaded2 = 550;
        await statsStorage.saveStats('example.org', { downloaded: downloaded2, uploaded: uploaded2 });
        stats = await statsStorage.getStats('example.org');
        expect(stats.downloaded).toEqual(downloaded2);
        expect(stats.uploaded).toEqual(uploaded2);

        const downloaded3 = 100;
        const uploaded3 = 400;
        await statsStorage.saveStats('example.org', { downloaded: downloaded3, uploaded: uploaded3 });
        stats = await statsStorage.getStats('example.org');
        expect(stats.downloaded).toEqual(downloaded2 + downloaded3);
        expect(stats.uploaded).toEqual(uploaded2 + uploaded3);

        const downloaded4 = 100;
        const uploaded4 = 400;
        await statsStorage.saveStats('example.org', { downloaded: downloaded4, uploaded: uploaded4 });
        stats = await statsStorage.getStats('example.org');
        expect(stats.downloaded).toEqual(downloaded2 + downloaded3);
        expect(stats.uploaded).toEqual(uploaded2 + uploaded3);

        const downloaded5 = 50;
        const uploaded5 = 300;
        await statsStorage.saveStats('example.org', { downloaded: downloaded5, uploaded: uploaded5 });
        stats = await statsStorage.getStats('example.org');
        expect(stats.downloaded).toEqual(downloaded2 + downloaded3 + downloaded5);
        expect(stats.uploaded).toEqual(uploaded2 + uploaded3 + uploaded5);
    });

    it('saves data for different domains', async () => {
        const domainRu = 'example.ru.org';
        const downloaded = 100;
        const uploaded = 500;

        let statsRu = await statsStorage.getStats(domainRu);
        expect(statsRu.downloaded).toEqual(0);
        expect(statsRu.uploaded).toEqual(0);

        await statsStorage.saveStats(domainRu, { downloaded, uploaded });
        statsRu = await statsStorage.getStats(domainRu);
        expect(statsRu.downloaded).toEqual(downloaded);
        expect(statsRu.uploaded).toEqual(uploaded);

        const domainUs = 'example.us.org';
        let statsUs = await statsStorage.getStats(domainUs);
        expect(statsUs.downloaded).toEqual(0);
        expect(statsUs.uploaded).toEqual(0);

        const downloadedUs1 = 200;
        const uploadedUs1 = 300;

        await statsStorage.saveStats(domainUs, {
            downloaded: downloadedUs1,
            uploaded: uploadedUs1,
        });
        statsUs = await statsStorage.getStats(domainUs);
        expect(statsUs.downloaded).toEqual(downloadedUs1);
        expect(statsUs.uploaded).toEqual(uploadedUs1);

        const downloadedUs2 = 300;
        const uploadedUs2 = 400;

        await statsStorage.saveStats(domainUs, {
            downloaded: downloadedUs2,
            uploaded: uploadedUs2,
        });
        statsUs = await statsStorage.getStats(domainUs);
        expect(statsUs.downloaded).toEqual(downloadedUs2);
        expect(statsUs.uploaded).toEqual(uploadedUs2);

        const downloadedUs3 = 200;
        const uploadedUs3 = 400;

        await statsStorage.saveStats(domainUs, {
            downloaded: downloadedUs3,
            uploaded: uploadedUs3,
        });
        statsUs = await statsStorage.getStats(domainUs);
        expect(statsUs.downloaded).toEqual(downloadedUs2 + downloadedUs3);
        expect(statsUs.uploaded).toEqual(uploadedUs2 + uploadedUs3);
    });
});