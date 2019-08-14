import os.path
import requests


for i in range(274,0, -1):
    if os.path.isfile('../../lawcommission/H'+str(i)+'.pdf') and os.path.isfile('../../lawcommission/Report'+str(i)+'.pdf'):
        try:
            file1 = open('../../lawcommission/H'+str(i)+'.pdf', 'rb')
            file2 = open('../../lawcommission/Report'+str(i)+'.pdf', 'rb')
            print('Sending request for '+str(i))
            response = requests.post('http://localhost:5001/multiple-law', files=(
                ('hindi', ('hindi', file1, 'application/pdf')),
                ('english',('english',file2,  'application/pdf'))
            ))
            print('Got response for '+str(i))
            print(response)
        except Exception as e:
            print(e)
            print('error for '+str(i))
    elif os.path.isfile('../../lawcommission/H'+str(i)+'.pdf') and os.path.isfile('../../lawcommission/report'+str(i)+'.pdf'):
        try:
            print('Sending request for '+str(i))
            file1 = open('../../lawcommission/H'+str(i)+'.pdf', 'rb')
            file2 = open('../../lawcommission/report'+str(i)+'.pdf', 'rb')
            response = requests.post('http://localhost:5001/multiple-law', files=(
                ('hindi', ('hindi', file1, 'application/pdf')),
                ('english',('english',file2,  'application/pdf'))
            ))
            print('Got response for '+str(i))
            print(response)
        except Exception as e:
            print(e)
            print('error for '+str(i))
    else:
        print('not available '+str(i))